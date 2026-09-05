/**
 * 登录所需的知音楼公共 HTTP 请求。
 * randstr 和二维码轮询必须走 public 版本，不能带旧 Authorization。
 */
'use strict';

const http = require('node:http');
const https = require('node:https');
const querystring = require('node:querystring');
const { getSign } = require('./sign.cjs');

const CAPI_BASE = 'https://yach-capi.zhiyinlou.com';
const PREFIX_BASE = {
  '94capi': CAPI_BASE,
  usergroup: CAPI_BASE,
};

const DEVICE_PROFILE = {
  clientVer: '2.0.0.5',
  os: process.platform === 'darwin' ? 'mac' : process.platform,
  osVer: process.versions.node,
  deviceName: 'yach-im-full',
  versionArea: 'YachAreaRed',
  userAgent: 'TAL-OpenClaw-yach-im-full/2026.9.4 (Node.js)',
  timezone: 'Asia/Shanghai',
};

function resolveUrl(route) {
  const prefix = String(route).split('/')[0];
  return `${PREFIX_BASE[prefix] || CAPI_BASE}/${route}`;
}

function deriveDeviceId(workcode = '') {
  return `yach-im-full-${require('node:crypto').createHash('md5').update(`yach-im-full-${workcode || 'anon'}`).digest('hex').toUpperCase()}`;
}

function buildHeaders(session = {}, sign, timestamp, extra = {}) {
  const headers = {
    Authorization: session.token || '',
    accesstoken: session.accesstoken || undefined,
    uid: String(session.uid || session.user?.id || ''),
    workcode: String(session.workcode || ''),
    deptid: String(session.deptid || ''),
    sign,
    timestamp: String(timestamp),
    'device-id': deriveDeviceId(session.workcode),
    'device-name': DEVICE_PROFILE.deviceName,
    os: DEVICE_PROFILE.os,
    'os-ver': DEVICE_PROFILE.osVer,
    'system-ver': DEVICE_PROFILE.osVer,
    'client-ver': DEVICE_PROFILE.clientVer,
    'yach-version-area': DEVICE_PROFILE.versionArea,
    timezone: DEVICE_PROFILE.timezone,
    'User-Agent': DEVICE_PROFILE.userAgent,
    HTTP_CONTENT_LANGUAGE: 'zh-CN',
    'Content-Type': 'application/x-www-form-urlencoded',
    ...extra,
  };
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
}

function buildPublicHeaders(sign, timestamp, extra = {}) {
  const headers = buildHeaders({}, sign, timestamp, extra);
  for (const key of ['Authorization', 'accesstoken', 'uid', 'workcode', 'deptid']) delete headers[key];
  return headers;
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const req = transport.request({
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: `${parsed.pathname}${parsed.search}`,
      method,
      headers,
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > 10 * 1024 * 1024) res.destroy(new Error('响应超过 10MB'));
        else chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          return;
        }
        try { resolve(text ? JSON.parse(text) : {}); } catch { resolve(text); }
      });
    });
    req.setTimeout(20_000, () => req.destroy(new Error('HTTP 请求超时')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function postPublic(route, body = {}) {
  const { sign, timestamp } = getSign(body);
  const encoded = querystring.stringify(body);
  return request('POST', `${resolveUrl(route)}?sign=${sign}&timestamp=${timestamp}`, buildPublicHeaders(sign, timestamp, {
    'Content-Length': Buffer.byteLength(encoded),
  }), encoded);
}

async function getPublic(route, params = {}) {
  const { sign, timestamp } = getSign(params);
  const query = querystring.stringify({ ...params, sign, timestamp });
  return request('GET', `${resolveUrl(route)}?${query}`, buildPublicHeaders(sign, timestamp));
}

async function post(route, body = {}, loadSession) {
  const session = loadSession();
  const { sign, timestamp } = getSign(body);
  const encoded = querystring.stringify(body);
  return request('POST', `${resolveUrl(route)}?sign=${sign}&timestamp=${timestamp}`, buildHeaders(session, sign, timestamp, {
    'Content-Length': Buffer.byteLength(encoded),
  }), encoded);
}

module.exports = { DEVICE_PROFILE, buildHeaders, buildPublicHeaders, getPublic, post, postPublic };
