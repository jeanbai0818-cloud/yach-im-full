/**
 * shimo-client.js — 薪火知识库文档正文读写（HTTP/2 客户端）
 *
 * 背景：yach-doc-shimo.zhiyinlou.com 的 /sdk/v2/api/ 路径要求 HTTP/2，
 *       Node.js 的 https.request 默认 HTTP/1.1 会被服务器以 400 拒绝。
 *       本模块统一用 node:http2 实现。
 *
 * 认证流程：
 *   1. GET 94capi/25doc/document/login?url=shimo_origin → 拿到含 JWT 的 login URL
 *   2. 跟随重定向（HTTP/1.1 即可）建立 cookie jar（drive_sid）
 *   3. GET /docs/{guid}（HTTP/1.1）提取 SDK_V2_TOKEN + SDK_V2_SIGNATURE
 *   4. 用 http2 发实际内容请求
 *
 * 实测验证（2026-07-21）：
 *   - GET /sdk/v2/api/files/internal/content/{guid}/r2m → 200 {"content":"...markdown"}
 *   - POST /sdk/v2/api/files/edit/{guid}/composeCustom  → 待验证
 */

'use strict';

const http = require('node:http');
const https = require('node:https');
const http2 = require('node:http2');
const { get: capiGet } = require('../../utils/request.js');

const SHIMO_ORIGIN = 'https://yach-doc-shimo.zhiyinlou.com';
const MAX_SHIMO_RESPONSE_BYTES = 10 * 1024 * 1024;
const SHIMO_TIMEOUT_MS = 20_000;

// ── cookie jar 工具 ──────────────────────────────────────────

function mergeCookies(jar, setCookieHeaders) {
  const result = { ...jar };
  (setCookieHeaders || []).forEach((raw) => {
    const [pair, ...rest] = raw.split(';');
    const maxAgeEntry = rest.find((s) => s.trim().toLowerCase().startsWith('max-age='));
    const [k, v] = pair.split('=');
    const key = k.trim();
    if (maxAgeEntry && parseInt(maxAgeEntry.split('=')[1], 10) <= 0) {
      delete result[key]; // cookie 被清除
    } else {
      result[key] = (v ?? '').trim();
    }
  });
  return result;
}

function cookieString(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// ── HTTP/1.1 单次请求（用于跟随重定向建立 session）────────────

function http1Get(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const mod = u.protocol === 'https:' ? https : http;
    const req = mod.request(
      { hostname: u.hostname, path: u.pathname + u.search, headers },
      (res) => {
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size > MAX_SHIMO_RESPONSE_BYTES) {
            res.destroy(new Error('Shimo 响应过大'));
            return;
          }
          chunks.push(c);
        });
        res.on('error', reject);
        res.on('end', () => resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        }));
      },
    );
    req.setTimeout(SHIMO_TIMEOUT_MS, () => req.destroy(new Error('Shimo 请求超时')));
    req.on('error', reject);
    req.end();
  });
}

// ── 建立 shimo session（跟随重定向，收集 cookie jar）──────────

async function buildShimoSession() {
  const loginResp = await capiGet('25doc/document/login', { url: SHIMO_ORIGIN });
  if (!loginResp?.obj?.url) throw new Error('25doc/document/login 未返回跳转 URL');

  let jar = {};
  let currentUrl = loginResp.obj.url;
  let finalUrl = currentUrl;

  for (let i = 0; i < 10; i++) {
    const cs = cookieString(jar);
    const res = await http1Get(currentUrl, cs ? { Cookie: cs } : {});
    jar = mergeCookies(jar, res.headers['set-cookie']);

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      currentUrl = new URL(res.headers.location, currentUrl).toString();
    } else {
      finalUrl = currentUrl;
      break;
    }
  }

  if (!jar.drive_sid) throw new Error('shimo session 建立失败：未能获取 drive_sid cookie');

  return { jar, finalUrl };
}

// ── 提取文档编辑上下文（SDK token + signature）────────────────

async function loadEditorContext(guid, session) {
  const docUrl = `${SHIMO_ORIGIN}/docs/${guid}`;
  const cs = cookieString(session.jar);
  const res = await http1Get(docUrl, {
    Cookie: cs,
    Referer: session.finalUrl || SHIMO_ORIGIN,
  });

  if (res.status !== 200) {
    throw new Error(`获取文档页面失败：HTTP ${res.status}（guid=${guid}）`);
  }

  const html = res.body;
  const token = html.match(/"SDK_V2_TOKEN":"([^"]+)"/)?.[1] ?? '';
  const signature = html.match(/"SDK_V2_SIGNATURE":"([^"]+)"/)?.[1] ?? '';
  const revMatch = html.match(/"rev":\s*(\d+)/i);
  const rev = revMatch ? Number(revMatch[1]) : 0;
  const contentUrlMatch = html.match(/"(?:contentUrl|content_url)":"((?:\\.|[^"])*)"/i);
  let contentUrl = '';
  if (contentUrlMatch) {
    try { contentUrl = JSON.parse(`"${contentUrlMatch[1]}"`); } catch {}
  }

  if (!token || !signature) {
    throw new Error(`文档页面未返回 SDK token/signature（guid=${guid}）`);
  }

  // 文档页面可能更新 cookie（如 drive_sid 续期）
  const updatedJar = mergeCookies(session.jar, res.headers['set-cookie']);

  return {
    token,
    signature,
    rev,
    contentUrl,
    jar: updatedJar,
    docUrl,
  };
}

// ── HTTP/2 请求（用于 /sdk/v2/api/ 路径）────────────────────

function http2Request(method, urlStr, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const client = http2.connect(`${u.protocol}//${u.hostname}`);

    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      try { client.destroy(); } catch {}
      reject(error);
    };
    client.on('error', finishReject);

    const reqHeaders = {
      [http2.constants.HTTP2_HEADER_METHOD]: method,
      [http2.constants.HTTP2_HEADER_PATH]: u.pathname + u.search,
      [http2.constants.HTTP2_HEADER_SCHEME]: 'https',
      [http2.constants.HTTP2_HEADER_AUTHORITY]: u.hostname,
      // ⭐ user-agent 是必须的：服务器不接受无 UA 的请求（HTTP/2 不自动添加）
      'user-agent': 'Mozilla/5.0 Yach-Agent/1.0',
      accept: 'application/json, text/plain, */*',
      ...headers,
    };

    if (body) {
      reqHeaders['content-type'] = 'application/json;charset=UTF-8';
      reqHeaders['content-length'] = String(Buffer.byteLength(body));
    }

    const req = client.request(reqHeaders);
    const chunks = [];
    let size = 0;
    let statusCode;
    let respHeaders;

    req.on('response', (h) => {
      statusCode = h[http2.constants.HTTP2_HEADER_STATUS];
      respHeaders = h;
    });
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_SHIMO_RESPONSE_BYTES) {
        req.close(http2.constants.NGHTTP2_CANCEL);
        finishReject(new Error(`Shimo HTTP/2 响应超过 ${MAX_SHIMO_RESPONSE_BYTES} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (settled) return;
      settled = true;
      client.close();
      resolve({
        status: statusCode,
        body: Buffer.concat(chunks).toString('utf8'),
        headers: respHeaders,
      });
    });
    req.setTimeout(SHIMO_TIMEOUT_MS, () => {
      req.close(http2.constants.NGHTTP2_CANCEL);
      finishReject(new Error('Shimo HTTP/2 请求超时'));
    });
    req.on('error', finishReject);

    if (body) req.write(body);
    req.end();
  });
}

function findContentUrl(value, depth = 0) {
  if (!value || depth > 6) return '';
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try { return findContentUrl(JSON.parse(value), depth + 1); } catch {}
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (key.replaceAll('_', '').toLowerCase().includes('contenturl') && typeof nested === 'string') {
        return nested;
      }
      const found = findContentUrl(nested, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function galleryToMarkdown(gallery) {
  if (typeof gallery !== 'string' || !gallery) return '[图片]';
  let url;
  try { url = new URL(gallery, SHIMO_ORIGIN).toString(); }
  catch { return '[图片]'; }
  return `![图片](${url})`;
}

function rawValueToMarkdown(value) {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return '';
  if (value.gallery) return galleryToMarkdown(value.gallery);
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  return '';
}

function rawContentToMarkdown(rawBody) {
  let payload;
  try {
    payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    throw new Error('Shimo 原始正文不是有效 JSON');
  }
  const operations = Array.isArray(payload)
    ? payload
    : (payload?.content || payload?.data || payload?.operations);
  if (!Array.isArray(operations)) throw new Error('Shimo 原始正文缺少操作数组');
  return operations.map((operation) => {
    if (Array.isArray(operation)) return rawValueToMarkdown(operation[1]);
    return rawValueToMarkdown(operation);
  }).join('');
}

async function readRawDocMarkdown(guid, session, ctx) {
  const cs = cookieString(ctx.jar);
  let contentUrl = ctx.contentUrl;
  if (!contentUrl) {
    const metadata = await http1Get(`${SHIMO_ORIGIN}/lizard-api/files/${guid}`, {
      Cookie: cs,
      Referer: ctx.docUrl,
      Accept: 'application/json',
    });
    if (metadata.status !== 200) {
      throw new Error(`读取文档元数据失败：HTTP ${metadata.status}（guid=${guid}）`);
    }
    let metadataPayload;
    try { metadataPayload = JSON.parse(metadata.body); }
    catch { throw new Error(`文档元数据不是有效 JSON（guid=${guid}）`); }
    contentUrl = findContentUrl(metadataPayload);
  }
  if (!contentUrl) throw new Error(`文档元数据未返回 contentUrl（guid=${guid}）`);
  const raw = await http1Get(new URL(contentUrl, SHIMO_ORIGIN).toString(), {
    Cookie: cs,
    Referer: ctx.docUrl,
  });
  if (raw.status !== 200) {
    throw new Error(`读取文档原始正文失败：HTTP ${raw.status}（guid=${guid}）`);
  }
  return rawContentToMarkdown(raw.body);
}

// ── 公共 API ─────────────────────────────────────────────────

/**
 * 读取薪火知识库文档的 Markdown 正文。
 * @param {string} guid  节点 node_open_url 里 /docs/{guid} 的 guid 部分
 * @returns {Promise<string>}  Markdown 文本
 */
async function readDocMarkdown(guid) {
  const session = await buildShimoSession();
  const ctx = await loadEditorContext(guid, session);
  const cs = cookieString(ctx.jar);

  const qs = new URLSearchParams({ range: '', signature: ctx.signature, token: ctx.token }).toString();
  const url = `${SHIMO_ORIGIN}/sdk/v2/api/files/internal/content/${guid}/r2m?${qs}`;

  const res = await http2Request('GET', url, {
    cookie: cs,
    referer: ctx.docUrl,
  });

  if (res.status !== 200) {
    try {
      return await readRawDocMarkdown(guid, session, ctx);
    } catch (fallbackError) {
      throw new Error(
        `读取文档正文失败：r2m HTTP ${res.status}；原始正文降级也失败：${fallbackError.message}`,
      );
    }
  }

  let payload;
  try { payload = JSON.parse(res.body); } catch { payload = { content: res.body }; }
  return payload.content ?? '';
}

/**
 * 写入薪火知识库文档的 Markdown 正文（替换全文）。
 * @param {string} guid     文档 guid
 * @param {string} content  新 Markdown 内容
 */
async function writeDocMarkdown(guid, content) {
  const session = await buildShimoSession();
  const ctx = await loadEditorContext(guid, session);
  const cs = cookieString(ctx.jar);

  const body = JSON.stringify({
    content,
    typ: 'md',
    cursorPos: 0,
    rev: ctx.rev,
  });

  const qs = new URLSearchParams({ signature: ctx.signature, token: ctx.token }).toString();
  const url = `${SHIMO_ORIGIN}/sdk/v2/api/files/edit/${guid}/composeCustom?${qs}`;

  const res = await http2Request('POST', url, {
    cookie: cs,
    referer: ctx.docUrl,
  }, body);

  if (res.status !== 200 && res.status !== 204) {
    throw new Error(`写入文档正文失败：HTTP ${res.status}（guid=${guid}）body=${res.body?.slice(0, 200)}`);
  }

  return true;
}

/**
 * 从薪火知识库节点的 node_open_url 提取文档 guid。
 * 支持格式：/docs/{guid}?...  /folder/{guid}?...  /sheets/{guid}?...
 * @param {string} nodeOpenUrl
 * @returns {string|null}
 */
function extractGuidFromNodeUrl(nodeOpenUrl) {
  const m = nodeOpenUrl?.match(/\/(docs|sheets|slides|mindnotes)\/([a-zA-Z0-9]+)/);
  return m?.[2] ?? null;
}

module.exports = {
  readDocMarkdown,
  writeDocMarkdown,
  extractGuidFromNodeUrl,
  buildShimoSession,
  rawContentToMarkdown,
  findContentUrl,
};
