/**
 * OKR 客户端（okr-api.zhiyinlou.com）
 *
 * 鉴权：两步换票。
 *   1. POST 94capi/ucenter/auth/code            → 一次性 code（复用现有签名）
 *   2. POST okr-api.zhiyinlou.com/api/login/code?platform=3  body {code}
 *      → OKR 专属 Bearer token（data.token, data.expires 秒）
 *   之后业务接口带 Authorization: Bearer <token> + workcode + Okr-Uid + Okr-Cid。
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 okr/client.js，改写为 CJS，
 * 复用当前项目的 capi 签名 post 换 auth code。
 */
'use strict';

const { randomUUID } = require('node:crypto');
const { requestAuthCode } = require('../../../auth/web-sso');
const { fetchWithTimeout } = require('../../../utils/web-request');

const OKR_API_BASE_URL = 'https://okr-api.zhiyinlou.com';
const OKR_PLATFORM = '3';

function ensureRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function readString(v) {
  return String(v || '').trim();
}
function readNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function readErrorMessage(payload) {
  const r = ensureRecord(payload);
  return readString(r.message || r.msg || r.error || r.detail);
}
async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`OKR 接口返回了非 JSON 响应：${text.slice(0, 200) || response.statusText || 'empty'}`);
  }
}

function buildOkrHeaders(session) {
  return {
    Authorization: `${session.tokenType || 'Bearer'} ${session.accessToken}`,
    workcode: session.workcode,
    'Okr-Uid': session.workcode,
    'Okr-Cid': session.cid,
    Accept: 'application/json, text/plain, */*',
  };
}

/**
 * 用当前知音楼登录态换取 OKR Bearer token。
 * @param {string} existingCid 复用已有 cid（可选）
 */
async function loginOkr(existingCid) {
  const code = await requestAuthCode();
  const response = await fetchWithTimeout(`${OKR_API_BASE_URL}/api/login/code?platform=${OKR_PLATFORM}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const payload = await readJsonResponse(response);
  if (Number(payload.status || 0) !== 200) throw new Error(readErrorMessage(payload) || 'OKR 登录失败。');
  const data = ensureRecord(payload.data);
  const user = ensureRecord(data.user);
  const accessToken = readString(data.token || data.access_token);
  if (!accessToken) throw new Error('OKR 登录失败：未拿到 Bearer token。');
  const expiresSeconds = readNumber(data.expires || data.expires_in) ?? 0;
  const now = Date.now();
  return {
    accessToken,
    tokenType: readString(data.type || data.token_type) || 'Bearer',
    workcode: readString(user.workcode),
    uid: readString(user.uid || user.id),
    userId: readString(user.id || user.uid),
    userName: readString(user.name),
    department: readString(user.department),
    cid: existingCid || `OKR_DING_${randomUUID()}`,
    updatedAt: now,
    expiresAt: now + expiresSeconds * 1000,
  };
}

/** 业务请求（GET/POST 到 okr-api，带 Bearer）*/
async function requestOkrData(session, options) {
  const url = new URL(options.path.replace(/^\//, ''), `${OKR_API_BASE_URL}/`);
  url.searchParams.set('platform', OKR_PLATFORM);
  url.searchParams.set('workcode', session.workcode);
  Object.entries(options.params ?? {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const headers = buildOkrHeaders(session);
  let body;
  if (options.method === 'POST') {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body ?? {});
  }
  const response = await fetchWithTimeout(url, { method: options.method, headers, body });
  const payload = await readJsonResponse(response);
  if (Number(payload.status || 0) !== 200) {
    const err = new Error(readErrorMessage(payload) || `OKR 接口调用失败：${options.path}`);
    err.okrStatus = payload.status;
    throw err;
  }
  return payload;
}

module.exports = {
  loginOkr,
  requestOkrData,
  OKR_API_BASE_URL,
};
