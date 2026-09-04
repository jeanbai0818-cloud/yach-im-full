/**
 * 通用 Web 请求基础设施（cookie jar + 手动重定向 + 带超时 fetch）
 *
 * 用途：知音楼内部微应用（会议室 huiyi.tal.com / OKR / 邮件等）走的是
 *   「好未来统一登录 SSO → cookie 会话」，而非 capi 签名网关。
 *   这套工具提供浏览器式的 cookie jar、手动跟随 3xx 重定向、Set-Cookie 解析，
 *   是 web-sso 引擎与各 web 业务客户端的共同底座。
 *
 * 纯 Node 原生（require 'node:crypto' 之外无外部依赖）；Node 18+ 内置 fetch。
 * 逻辑参照旧插件 yach-omni-2.1.5 的 shared/fetch.js + web-sso/client.js 重写为 CJS。
 */
'use strict';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_COOKIE_PATH = '/';
const DEFAULT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) yach-agent';

/**
 * 带超时的 fetch。timeoutMs 优先；未传则默认 30s。
 */
async function fetchWithTimeout(input, init = {}, timeoutMs) {
  const explicitTimeout = timeoutMs ?? init.timeoutMs;
  const { timeoutMs: _ignored, ...nativeInit } = init;
  const effectiveTimeout = explicitTimeout ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error(`fetch timeout after ${effectiveTimeout}ms`)),
    effectiveTimeout,
  );
  try {
    return await fetch(input, { ...nativeInit, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ── Cookie 解析与 jar ────────────────────────────────────────

function parseCookieTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCookieDomain(value) {
  return String(value).trim().replace(/^\./, '').toLowerCase();
}

/** 解析单条 Set-Cookie 字符串为 cookie 对象 */
function parseSetCookie(rawCookie, url) {
  const segments = String(rawCookie).split(';').map((s) => s.trim()).filter(Boolean);
  const [pair, ...attributes] = segments;
  if (!pair) return null;
  const sep = pair.indexOf('=');
  if (sep <= 0) return null;
  const cookie = {
    name: pair.slice(0, sep),
    value: pair.slice(sep + 1),
    domain: url.hostname.toLowerCase(),
    path: DEFAULT_COOKIE_PATH,
    secure: url.protocol === 'https:',
    httpOnly: false,
    expiresAt: null,
    hostOnly: true,
  };
  for (const attribute of attributes) {
    const [name, ...valueParts] = attribute.split('=');
    const n = String(name || '').trim().toLowerCase();
    const v = valueParts.join('=').trim();
    switch (n) {
      case 'domain':
        cookie.domain = normalizeCookieDomain(v || url.hostname);
        cookie.hostOnly = false;
        break;
      case 'path':
        cookie.path = v || DEFAULT_COOKIE_PATH;
        break;
      case 'secure':
        cookie.secure = true;
        break;
      case 'httponly':
        cookie.httpOnly = true;
        break;
      case 'expires':
        cookie.expiresAt = parseCookieTimestamp(v);
        break;
      case 'max-age': {
        const seconds = Number(v);
        if (Number.isFinite(seconds)) cookie.expiresAt = Date.now() + seconds * 1000;
        break;
      }
      default:
        break;
    }
  }
  return cookie.name ? cookie : null;
}

/** 兜底：把一整行合并的 Set-Cookie 头拆成多条 */
function splitRawSetCookieHeader(rawHeader) {
  return String(rawHeader || '')
    .split(/,(?=\s*[^;,=\s]+=[^;]+)/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cookieIdentity(cookie) {
  return `${cookie.domain}|${cookie.path}|${cookie.name}|${cookie.hostOnly ? 'host' : 'domain'}`;
}

function isCookieExpired(cookie, now = Date.now()) {
  return cookie.expiresAt !== null && cookie.expiresAt <= now;
}

function domainMatches(hostname, cookie) {
  const host = String(hostname).toLowerCase();
  const domain = String(cookie.domain).toLowerCase();
  if (cookie.hostOnly) return host === domain;
  return host === domain || host.endsWith(`.${domain}`);
}

function pathMatches(requestPath, cookiePath) {
  const p = cookiePath || DEFAULT_COOKIE_PATH;
  if (p === DEFAULT_COOKIE_PATH) return true;
  return requestPath === p || requestPath.startsWith(`${p.replace(/\/$/, '')}/`);
}

/** 合并 cookie（去重、过期删除、稳定排序） */
function mergeCookies(existing, incoming) {
  const bucket = new Map();
  (existing || []).forEach((cookie) => {
    if (!isCookieExpired(cookie)) bucket.set(cookieIdentity(cookie), cookie);
  });
  (incoming || []).forEach((cookie) => {
    const key = cookieIdentity(cookie);
    if (isCookieExpired(cookie)) {
      bucket.delete(key);
      return;
    }
    bucket.set(key, cookie);
  });
  return Array.from(bucket.values()).sort(
    (a, b) =>
      a.domain.localeCompare(b.domain, 'en-US') ||
      a.path.localeCompare(b.path, 'en-US') ||
      a.name.localeCompare(b.name, 'en-US'),
  );
}

/** 为某个 URL 生成 Cookie 请求头 */
function buildCookieHeader(cookies, url) {
  return (cookies || [])
    .filter((c) => !isCookieExpired(c))
    .filter((c) => domainMatches(url.hostname, c))
    .filter((c) => pathMatches(url.pathname || DEFAULT_COOKIE_PATH, c.path))
    .filter((c) => !c.secure || url.protocol === 'https:')
    .sort((a, b) => b.path.length - a.path.length)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

/** 从响应里抽取全部 Set-Cookie（兼容多种 Node fetch header 实现） */
function extractCookiesFromResponse(response, url) {
  const h = response.headers;
  let raw = [];
  if (typeof h.getSetCookie === 'function') {
    raw = h.getSetCookie();
  } else if (typeof h.raw === 'function') {
    const r = h.raw();
    raw = r?.['set-cookie'] ?? r?.['Set-Cookie'] ?? [];
  }
  if (!raw || raw.length === 0) {
    const combined = h.get('set-cookie');
    if (combined) raw = splitRawSetCookieHeader(combined);
    else {
      raw = Array.from(h.entries())
        .filter(([k]) => k.toLowerCase() === 'set-cookie')
        .flatMap(([, v]) => splitRawSetCookieHeader(v));
    }
  }
  return raw.map((c) => parseSetCookie(c, url)).filter(Boolean);
}

/** 浏览器风格请求头（带 cookie） */
function createBrowserHeaders(url, cookies, ua = DEFAULT_UA) {
  const headers = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'User-Agent': ua,
  };
  const cookieHeader = buildCookieHeader(cookies, url);
  if (cookieHeader) headers.Cookie = cookieHeader;
  return headers;
}

/**
 * 手动跟随 3xx 重定向，逐跳收集 cookie。
 * @param {object} opts { url, cookies, maxRedirects?, ua?, stopOn?(url)->bool, logger? }
 * @returns {Promise<{finalUrl, cookies, html, status}>}
 */
async function followBrowserRedirects(opts) {
  const maxRedirects = opts.maxRedirects ?? 12;
  const ua = opts.ua ?? DEFAULT_UA;
  let currentUrl = opts.url;
  let cookies = opts.cookies || [];
  for (let step = 0; step < maxRedirects; step += 1) {
    const requestUrl = new URL(currentUrl);
    const response = await fetchWithTimeout(requestUrl, {
      method: 'GET',
      headers: createBrowserHeaders(requestUrl, cookies, ua),
      redirect: 'manual',
    });
    cookies = mergeCookies(cookies, extractCookiesFromResponse(response, requestUrl));
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      currentUrl = new URL(location, requestUrl).toString();
      if (opts.stopOn && opts.stopOn(new URL(currentUrl))) {
        return { finalUrl: currentUrl, cookies, html: '', status: response.status };
      }
      continue;
    }
    if (!response.ok) {
      throw new Error(`SSO 跳转失败：HTTP ${response.status}`);
    }
    return {
      finalUrl: response.url || currentUrl,
      cookies,
      html: await response.text(),
      status: response.status,
    };
  }
  throw new Error(`SSO 重定向次数超过 ${maxRedirects} 次。`);
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_UA,
  fetchWithTimeout,
  parseSetCookie,
  splitRawSetCookieHeader,
  mergeCookies,
  buildCookieHeader,
  extractCookiesFromResponse,
  createBrowserHeaders,
  followBrowserRedirects,
  isCookieExpired,
  domainMatches,
};
