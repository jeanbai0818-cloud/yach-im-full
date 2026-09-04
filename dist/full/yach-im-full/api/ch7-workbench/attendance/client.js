/**
 * 知音楼打卡 API Client (clockin-api.zhiyinlou.com)
 *
 * 纯 TypeScript/JS 重写，不依赖 Python 子进程。
 * 参考实现：/vol2/1000/docker/yach-attendance/python/yachattend/attendance/__init__.py
 *
 * 核心流程：
 *   1. capi session → /94capi/ucenter/auth/code → 拿 auth_code
 *   2. auth_code → clockin-api /login/code → 拿打卡 access_token (Bearer)
 *   3. /api/group → 查排班 → /api/time/result → 预检
 *   4. /api/location → 随机地理 → RSA 加密 crc → /api/record → 写卡
 */

const crypto = require('crypto');
const https = require('https');
const os = require('os');
const { URL, URLSearchParams } = require('url');
const { loadSession } = require('../../../auth/session');
const { getSign } = require('../../../utils/sign');

// ── 常量 ─────────────────────────────────────────────────────────────────────

const CLOCKIN_API_BASE = 'https://clockin-api.zhiyinlou.com';
const CAPI_BASE = 'https://yach-capi.zhiyinlou.com';
const YACH_SIGN_KEY = '59266f227cfd7a67797012108df99c9b';
const PLATFORM_CONFIG_KEY = 'SDJ0U#$2io9F&#*J';

// RSA 公钥（硬编码，参考 Python 的 MOD_HEX）
const RSA_MOD_HEX =
  'AA625970F5C0834457E2093F838EDF2374B12B673B48922276E89E2540E898DFD3558411E3938018F0846F3F8016DA00FE75D08EDA810CC5F7E2FC4F55C0828624B24A14566A10F747069BBA87E1BB6503248194F8A19A9F667C72FF406945C9515E61DD6DBAE15AF88027EDC77A19572E9744AECE1F7D5888C2040B5D1F80E1';
const RSA_MOD_INT = BigInt('0x' + RSA_MOD_HEX);
const RSA_EXP_INT = 65537n;
const RSA_KEY_BYTES = Number(BigInt(RSA_MOD_INT.toString(2).length + 7) >> 3n);

// 办公室坐标
const OFFICE_BASE_LON = 116.31489783525467;
const OFFICE_BASE_LAT = 40.106470873147195;
const OFFICE_DEFAULT_ADDRESS = '北京市昌平区安居路靠近好未来大楼';

// 设备伪装
const FAKE_BRAND = 'Apple';
const FAKE_MODEL = 'iPad8,6';
const FAKE_VERSION = '26.4';
const FAKE_NET_INFO = 'wifi';

// 地理随机化
const OFFICE_GEO_SEED_METERS = 100.0;
const RANDOMIZED_GEO_RADIUS_METERS = 300.0;
const RANDOMIZED_GEO_MAX_ATTEMPTS = 12;

const DEFAULT_CLIENT_VERSION = '1.9.19.12';
const WORK_DATE_FMT_SUFFIX = 'T00:00:00.000Z';

// ── Session 加载 ─────────────────────────────────────────────────────────────

/**
 * 从插件 session 文件加载知音楼登录态
 * @returns {{token, gtoken, workcode, deptid, cloudtoken}|null}
 */
function loadPluginSession() {
  const s = loadSession();
  if (!s.token || !s.workcode) return null;
  return {
    token: s.token,
    gtoken: s.gtoken || genGtoken(s.workcode, s.cp_id || 1),
    workcode: s.workcode,
    deptid: s.deptid || '',
    cloudtoken: s.cloudtoken || '',
  };
}

// ── 签名 & gtoken ─────────────────────────────────────────────────────────────

function genGtoken(workcode, cpId) {
  const key = Buffer.from(PLATFORM_CONFIG_KEY, 'utf8');
  if (key.byteLength !== 16) return '';
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  cipher.setAutoPadding(true);
  return Buffer.concat([
    cipher.update(`${workcode}_${cpId || 1}`, 'utf8'),
    cipher.final(),
  ]).toString('base64');
}

// ── Yach capi 签名（用于 /94capi/ucenter/auth/code）──────────────────────────

function flattenQuery(prefix, value, target) {
  if (Array.isArray(value)) {
    value.forEach((item, i) => flattenQuery(`${prefix}[${i}]`, item, target));
    return;
  }
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    Object.entries(value).forEach(([k, v]) => flattenQuery(`${prefix}[${k}]`, v, target));
    return;
  }
  target[prefix] = value == null ? '' : String(value);
}

function toQueryRecord(payload) {
  const out = {};
  if (!payload || typeof payload !== 'object') return out;
  Object.entries(payload).forEach(([k, v]) => flattenQuery(k, v, out));
  return out;
}

function buildYachSignature(payload = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const qr = { ...toQueryRecord(payload), timestamp: String(timestamp) };
  const src = [
    ...Object.keys(qr).sort().map(k => `${k}=${qr[k]}`),
    `key=${YACH_SIGN_KEY}`,
  ].join('&');
  return { sign: crypto.createHash('md5').update(src).digest('hex'), timestamp };
}

function deriveDeviceId() {
  const seed = `yach-omni|${os.hostname()}|${os.homedir()}`;
  return crypto.createHash('md5').update(seed).digest('hex').slice(0, 32);
}

function buildYachHeaders(session, url, payload = {}) {
  const { sign, timestamp } = buildYachSignature(payload);
  return {
    Authorization: session.token,
    gtoken: session.gtoken || genGtoken(session.workcode, 1),
    workcode: session.workcode,
    deptid: session.deptid || '',
    HTTP_CONTENT_LANGUAGE: 'zh-CN',
    sign,
    timestamp: String(timestamp),
    os: process.platform,
    'device-id': deriveDeviceId(),
    'device-name': os.hostname() || 'yach-agent',
    'system-ver': `${process.platform} ${os.release()}`,
    'client-ver': '.5.0',
    traceid: `${deriveDeviceId().slice(0, 12)}-${timestamp}-${url}`,
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  };
}

// ── HTTP 请求工具 ─────────────────────────────────────────────────────────────

function httpGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.end();
  });
}

function httpPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const formData = typeof body === 'string' ? body : new URLSearchParams(body).toString();
    const req = https.request({
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(formData),
        ...headers,
      },
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('HTTP timeout')); });
    req.write(formData);
    req.end();
  });
}

// ── capi 请求（带签名）──────────────────────────────────────────────────────

function capiPost(path, session, body = {}) {
  const headers = buildYachHeaders(session, path, body);
  const formData = new URLSearchParams(toQueryRecord(body)).toString();
  const url = `${CAPI_BASE}${path}`;
  return httpPost(url, formData, headers);
}

// ── clockin-api 请求（Bearer token）──────────────────────────────────────────

function authHeaders(accessToken, workcode, clientVersion = DEFAULT_CLIENT_VERSION) {
  const base = process.platform === 'darwin'
    ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    : process.platform.startsWith('linux')
      ? 'Mozilla/5.0 (X11; Linux x86_64)'
      : 'Mozilla/5.0';
  return {
    Authorization: `Bearer ${accessToken}`,
    'X-Workcode': workcode,
    'User-Agent': `${base} YachPc/${clientVersion}`,
    Origin: 'https://clockin.zhiyinlou.com',
    Referer: 'https://clockin.zhiyinlou.com/',
    Accept: 'application/json, text/plain, */*',
  };
}

function clockinGet(path, accessToken, workcode, clientVersion) {
  const url = `${CLOCKIN_API_BASE}${path}`;
  return httpGet(url, authHeaders(accessToken, workcode, clientVersion));
}

function clockinPost(path, body, accessToken, workcode, clientVersion) {
  const url = `${CLOCKIN_API_BASE}${path}`;
  const headers = {
    ...authHeaders(accessToken, workcode, clientVersion),
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  return httpPost(url, body, headers);
}

// ── RSA 加密（crc 字段）─────────────────────────────────────────────────────

function randNonZero(n) {
  const out = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    let b;
    do { b = crypto.randomBytes(1)[0]; } while (b === 0);
    out[i] = b;
  }
  return out;
}

function rsaPkcs1EncryptHex(plaintext) {
  const msg = Buffer.from(plaintext, 'utf8');
  const psLen = RSA_KEY_BYTES - msg.length - 3;
  if (psLen < 8) throw new Error('plaintext too long for RSA block');

  // EM = 0x00 || 0x02 || PS (nonzero random) || 0x00 || M
  const em = Buffer.alloc(3 + psLen + msg.length);
  em[0] = 0x00;
  em[1] = 0x02;
  const ps = randNonZero(psLen);
  ps.copy(em, 2);
  em[2 + psLen] = 0x00;
  msg.copy(em, 3 + psLen);

  const m = BigInt('0x' + em.toString('hex'));
  const c = m ** RSA_EXP_INT % RSA_MOD_INT;
  const hex = c.toString(16);
  const padded = '0'.repeat(RSA_KEY_BYTES * 2 - hex.length) + hex;
  return padded;
}

// ── 地理随机化 ────────────────────────────────────────────────────────────────

function randomGeoAround(centerLon, centerLat, maxMeters) {
  const r = maxMeters * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  const dx = r * Math.cos(theta);
  const dy = r * Math.sin(theta);
  const dlat = dy / 111111.0;
  const cosLat = Math.cos(centerLat * Math.PI / 180);
  const dlon = cosLat < 1e-6 ? 0 : dx / (111111.0 * cosLat);
  return [`${centerLon + dlon}`, `${centerLat + dlat}`];
}

function fakeOfficeGeo(maxMeters = OFFICE_GEO_SEED_METERS) {
  return randomGeoAround(OFFICE_BASE_LON, OFFICE_BASE_LAT, maxMeters);
}

// ── 时间 ──────────────────────────────────────────────────────────────────────

function workDateStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}${WORK_DATE_FMT_SUFFIX}`;
}

function groupPath() {
  return `/api/group?work_date=${encodeURIComponent(workDateStr())}`;
}

function locationPath(lon, lat) {
  return `/api/location?lon=${encodeURIComponent(lon)}&lat=${encodeURIComponent(lat)}`;
}

function extractLocationCenter(location) {
  const coord = ((location || {}).data || {}).coord || {};
  const lon = parseFloat(coord.lon);
  const lat = parseFloat(coord.lat);
  if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat];
  return null;
}

function locationAllowsClockin(location) {
  const data = ((location || {}).data) || {};
  return Number(location?.code || 0) === 200 && !!data.is_allow_clockin;
}

// ── 排班记录分类 ──────────────────────────────────────────────────────────────

function classifyScheduleRecord(item) {
  const checkType = String(item.check_type || '').trim();
  const record = item.record || {};
  const hasRecord = !!(record || item.has_record);
  const sourceType = String(record.source_type || '').trim().toUpperCase();
  const checkTime = String(record.check_time || '').trim();
  const planDateTime = String(item.plan_date_time || '').trim();
  const address = String(record.address || '').trim();
  const clockinType = Number(item.clockin_type || 0);
  const isCurrent = !!item.is_current;

  if (!hasRecord) {
    return { hasRecord: false, countsAsCompleted: false, isProvisional: false, classification: 'none', checkType, planDateTime, checkTime, sourceType, clockinType, address };
  }
  if (!record || Object.keys(record).length === 0) {
    return { hasRecord: true, countsAsCompleted: false, isProvisional: true, classification: 'pending-slot-with-record-flag', checkType, planDateTime, checkTime, sourceType, clockinType, address };
  }
  if (clockinType === 1 || address.includes('门禁')) {
    return { hasRecord: true, countsAsCompleted: false, isProvisional: true, classification: 'gate-pass-auxiliary', checkType, planDateTime, checkTime, sourceType, clockinType, address, record };
  }
  return { hasRecord: true, countsAsCompleted: true, isProvisional: false, classification: 'completed', checkType, planDateTime, checkTime, sourceType, clockinType, address, record };
}

function writeGuard(checkType, blockingStatus, provisionalStatus) {
  if (checkType === 'OnDuty' && blockingStatus) {
    return { requiresForce: true, reason: '今天已存在已完成的 OnDuty 记录，覆盖写卡必须显式加 --force。' };
  }
  if (checkType === 'OffDuty' && blockingStatus) {
    const st = String(blockingStatus.sourceType || '').trim().toUpperCase();
    if (st === 'USER') {
      return { requiresForce: true, reason: '今天已存在 source_type=USER 的已完成 OffDuty 记录，覆盖写卡必须显式加 --force。' };
    }
  }
  return { requiresForce: false, reason: (provisionalStatus || {}).reason || '' };
}

// ── 地理随机化解析 ───────────────────────────────────────────────────────────

function resolveRandomizedGeo(ctx, headers) {
  const [seedLon, seedLat] = [ctx.lon, ctx.lat];
  const seedLocation = clockinGet(locationPath(seedLon, seedLat), ctx.accessToken, ctx.workcode, ctx.clientVersion);

  // 由于 httpGet 是 async 的，这里需要 async
  // 实际实现见 service.js
  return null; // placeholder, 实际在 service 中调用
}

// ── 导出 ──────────────────────────────────────────────────────────────────────

module.exports = {
  // 常量
  CLOCKIN_API_BASE,
  CAPI_BASE,
  OFFICE_BASE_LON,
  OFFICE_BASE_LAT,
  OFFICE_DEFAULT_ADDRESS,
  OFFICE_GEO_SEED_METERS,
  RANDOMIZED_GEO_RADIUS_METERS,
  RANDOMIZED_GEO_MAX_ATTEMPTS,
  DEFAULT_CLIENT_VERSION,
  FAKE_BRAND,
  FAKE_MODEL,
  FAKE_VERSION,
  FAKE_NET_INFO,
  RSA_KEY_BYTES,

  // session
  loadPluginSession,

  // 签名
  genGtoken,
  buildYachSignature,
  buildYachHeaders,
  deriveDeviceId,

  // HTTP
  httpGet,
  httpPost,
  capiPost,
  clockinGet,
  clockinPost,
  authHeaders,

  // RSA
  rsaPkcs1EncryptHex,

  // 地理
  randomGeoAround,
  fakeOfficeGeo,
  extractLocationCenter,
  locationAllowsClockin,

  // 时间
  workDateStr,
  groupPath,
  locationPath,

  // 排班
  classifyScheduleRecord,
  writeGuard,

  // 辅助
  toQueryRecord,
};
