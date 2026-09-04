/**
 * 通用「好未来统一登录」SSO 引擎
 *
 * 知音楼内部微应用（会议室 huiyi.tal.com、OKR、邮件、intelloft 等）
 * 都通过好未来统一登录 portal（sso.100tal.com / controller.100tal.com）单点登录，
 * 换取目标站点的 cookie 会话。本引擎用**已登录的知音楼 session** 自动完成换登，
 * 无需浏览器 / 抓包。
 *
 * 两种流程（自动降级）：
 *   1. authCode 流：POST 94capi/ucenter/auth/code 拿一次性 code
 *      → 目标登录 URL 拼 _authCode → 跟随重定向直到落到目标站点。
 *   2. tmpCode 流（authCode 不奏效时降级）：读登录页里的 __SSO_REDIRCECTURL__
 *      → POST 94capi/user/get/tmp/code (app_id=mark) 拿 tmpCode
 *      → oauth URL 拼 loginTmpCode + version → 跟随重定向。
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 web-sso/client.js，改写为 CJS 并复用当前
 * 项目的 capi 签名请求（src/utils/request.js 的 post）。
 */
'use strict';

const { post } = require('../utils/request');
const { refreshSessionToken, isLoggedOutResponse } = require('./token-refresh');
const {
  mergeCookies,
  extractCookiesFromResponse,
  createBrowserHeaders,
  followBrowserRedirects,
  fetchWithTimeout,
  isCookieExpired,
  domainMatches,
} = require('../utils/web-request');

const AUTH_CODE_PATH = '94capi/ucenter/auth/code';
const TMP_CODE_PATH = '94capi/user/get/tmp/code';
const DEFAULT_TMP_CODE_APP_ID = 'mark';

function ensureRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function asString(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function normalizeBase64(value) {
  const n = String(value).trim().replace(/-/g, '+').replace(/_/g, '/');
  const r = n.length % 4;
  return r === 0 ? n : `${n}${'='.repeat(4 - r)}`;
}
function decodePortalRedirect(value) {
  if (!value) return '';
  try {
    const decoded = Buffer.from(normalizeBase64(value), 'base64').toString('utf8').trim();
    if (!decoded) return '';
    return new URL(decoded).toString();
  } catch {
    return '';
  }
}
function looksLikePortalLoginUrl(url) {
  return url.pathname.startsWith('/portal/login/');
}
function isPortalHtml(html) {
  return /__SSO_REDIRCECTURL__|好未来统一登录|portal\/login\//i.test(html || '');
}
function parseLoginPageContext(html) {
  const redirectUrl = (html || '').match(/var\s+__SSO_REDIRCECTURL__\s*=\s*'([^']+)'/i)?.[1]?.trim() || '';
  return { redirectUrl };
}

/**
 * 归一化目标 URL，解析出目标 host / 登录入口。
 * 支持直接传 portal 登录页（含 base64 redirect）或普通目标 URL。
 */
function normalizeTargetUrl(raw) {
  const t = String(raw || '').trim();
  if (!t) throw new Error('内部系统 URL 不能为空。');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t)) return new URL(t).toString();
  return new URL(`https://${t}`).toString();
}

function resolveTargetDescriptor(raw) {
  const inputUrl = normalizeTargetUrl(raw);
  const parsed = new URL(inputUrl);
  if (!looksLikePortalLoginUrl(parsed)) {
    return { inputUrl, targetUrl: inputUrl, targetHost: parsed.hostname.toLowerCase(), loginUrl: null };
  }
  const decoded = decodePortalRedirect(parsed.searchParams.get('redirect') || '');
  const targetUrl = decoded || inputUrl;
  let targetHost = parsed.hostname.toLowerCase();
  try {
    targetHost = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    /* keep portal host */
  }
  return { inputUrl, targetUrl, targetHost, loginUrl: inputUrl };
}

function hasReusableTargetCookies(cookies, targetHost) {
  return (cookies || []).some((c) => !isCookieExpired(c) && domainMatches(targetHost, c));
}
function reachedTarget(result, targetHost) {
  let finalHost = '';
  try {
    finalHost = new URL(result.finalUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (finalHost !== targetHost.toLowerCase()) return false;
  if (isPortalHtml(result.html)) return false;
  return hasReusableTargetCookies(result.cookies, targetHost);
}

// ── 换票（复用 capi 签名 post）──────────────────────────────

async function requestAuthCode() {
  // 对齐知音楼客户端：在需要跨系统换票前先续期 HTTP 登录 Token。
  // 续期完全通过 CAPI 完成，适用于无 GUI 的服务器和虚拟机。
  let refreshError = null;
  try {
    await refreshSessionToken();
  } catch (error) {
    refreshError = error;
  }

  const r = ensureRecord(await post(AUTH_CODE_PATH, {}));
  if (Number(r.code || 0) !== 200) {
    if (isLoggedOutResponse(r)) {
      if (refreshError?.code === 'YACH_LOGIN_REQUIRED') throw refreshError;
      const error = new Error('知音楼登录已失效，请在当前 OpenClaw 实例执行 /yach-login 重新扫码。');
      error.code = 'YACH_LOGIN_REQUIRED';
      throw error;
    }
    throw new Error(r.msg || 'auth/code 接口失败');
  }
  const code = asString(ensureRecord(r.obj).code).trim();
  if (!code) throw new Error('SSO 没有返回 authCode。');
  return code;
}
async function requestTmpCode() {
  const r = ensureRecord(await post(TMP_CODE_PATH, { app_id: DEFAULT_TMP_CODE_APP_ID }));
  if (Number(r.code || 0) !== 200) throw new Error(r.msg || 'tmp/code 接口失败');
  const tmp = asString(ensureRecord(r.obj).tmp_code).trim();
  if (!tmp) throw new Error('SSO 没有返回 tmpCode。');
  return tmp;
}

// ── 登录入口解析 ────────────────────────────────────────────

async function resolveLoginEntry(targetUrl) {
  const descriptor = resolveTargetDescriptor(targetUrl);
  if (descriptor.loginUrl) {
    return { targetUrl: descriptor.targetUrl, targetHost: descriptor.targetHost, loginUrl: descriptor.loginUrl, cookies: [] };
  }
  const initialUrl = new URL(descriptor.targetUrl);
  const initialResponse = await fetchWithTimeout(initialUrl, {
    method: 'GET',
    headers: createBrowserHeaders(initialUrl, []),
    redirect: 'manual',
  });
  let cookies = mergeCookies([], extractCookiesFromResponse(initialResponse, initialUrl));
  const initialLocation = initialResponse.headers.get('location');
  if (initialResponse.status >= 300 && initialResponse.status < 400 && initialLocation) {
    const redirectUrl = new URL(initialLocation, initialUrl).toString();
    if (looksLikePortalLoginUrl(new URL(redirectUrl))) {
      return { targetUrl: descriptor.targetUrl, targetHost: descriptor.targetHost, loginUrl: redirectUrl, cookies };
    }
    const redirected = await followBrowserRedirects({
      url: redirectUrl,
      cookies,
      stopOn: (url) => looksLikePortalLoginUrl(url),
    });
    cookies = redirected.cookies;
    if (looksLikePortalLoginUrl(new URL(redirected.finalUrl))) {
      return { targetUrl: descriptor.targetUrl, targetHost: descriptor.targetHost, loginUrl: redirected.finalUrl, cookies };
    }
  }
  throw new Error(`目标地址没有跳到受支持的统一登录页：${descriptor.targetUrl}`);
}

// ── 两种流程 ────────────────────────────────────────────────

async function attemptAuthCodeFlow(entry) {
  const authCode = await requestAuthCode();
  const authLoginUrl = new URL(entry.loginUrl);
  authLoginUrl.searchParams.set('_authCode', authCode);
  const result = await followBrowserRedirects({ url: authLoginUrl.toString(), cookies: entry.cookies });
  if (!reachedTarget(result, entry.targetHost)) return null;
  return {
    targetUrl: entry.targetUrl,
    targetHost: entry.targetHost,
    loginUrl: entry.loginUrl,
    finalUrl: result.finalUrl,
    flow: 'authCode',
    cookies: result.cookies,
    updatedAt: Date.now(),
  };
}

async function attemptTmpCodeFlow(entry) {
  const loginPage = await followBrowserRedirects({ url: entry.loginUrl, cookies: entry.cookies });
  const { redirectUrl } = parseLoginPageContext(loginPage.html);
  if (!redirectUrl) throw new Error('SSO 登录页没有返回 yach-oapi 重定向地址。');
  const tmpCode = await requestTmpCode();
  const oauthUrl = new URL(redirectUrl);
  oauthUrl.searchParams.set('loginTmpCode', tmpCode);
  oauthUrl.searchParams.set('version', `${Math.random()}`);
  const result = await followBrowserRedirects({ url: oauthUrl.toString(), cookies: loginPage.cookies });
  if (!reachedTarget(result, entry.targetHost)) {
    throw new Error(`tmpCode 登录没有落到目标站点：${entry.targetHost}`);
  }
  return {
    targetUrl: entry.targetUrl,
    targetHost: entry.targetHost,
    loginUrl: entry.loginUrl,
    finalUrl: result.finalUrl,
    flow: 'loginTmpCode',
    cookies: result.cookies,
    updatedAt: Date.now(),
  };
}

/**
 * 用当前知音楼登录态换取目标内部系统的 cookie 会话。
 * @param {string} targetUrl 目标系统 URL 或 portal 登录页 URL
 * @returns {Promise<{targetUrl,targetHost,loginUrl,finalUrl,flow,cookies,updatedAt}>}
 */
async function bootstrapWebSsoSession(targetUrl) {
  const entry = await resolveLoginEntry(targetUrl);
  const authCodeSession = await attemptAuthCodeFlow(entry);
  if (authCodeSession) return authCodeSession;
  return attemptTmpCodeFlow(entry);
}

module.exports = {
  bootstrapWebSsoSession,
  resolveTargetDescriptor,
  normalizeTargetUrl,
  requestAuthCode,
  requestTmpCode,
  // 供会议室这种有自定义 SSO 链的模块复用底层能力
  reachedTarget,
  looksLikePortalLoginUrl,
};
