/**
 * 知音楼打卡业务逻辑
 *
 * 参考实现：/vol2/1000/docker/yach-attendance/python/yachattend/attendance/__init__.py
 * 纯 JS 重写，不依赖 Python 子进程。
 *
 * 核心流程：
 *   1. capi session → /94capi/ucenter/auth/code → 拿 auth_code
 *   2. auth_code → clockin-api /login/code → 拿打卡 access_token (Bearer)
 *   3. /api/group → 查排班 → /api/time/result → 预检
 *   4. /api/location → 随机地理 → RSA 加密 crc → /api/record → 写卡
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { URLSearchParams } = require('url');

const C = require('./client.js');

// ── 状态持久化 ────────────────────────────────────────────────────────────────

function stateDir() {
  // 尝试多个候选路径
  const candidates = [
    process.env.YACH_STATE_DIR,
    path.join(os.homedir(), '.openclaw/workspace-yach/sessions'),
    path.resolve(__dirname, '../../../../sessions'),
  ].filter(Boolean);
  for (const d of candidates) {
    try {
      const resolved = path.resolve(d);
      fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    } catch { /* 继续找 */ }
  }
  return path.resolve(__dirname, '../../../../sessions');
}

function attendanceAuthPath() {
  return path.join(stateDir(), 'attendance-auth.json');
}

function atomicWriteJson(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.copyFileSync(tmp, filePath);
  fs.chmodSync(filePath, 0o600);
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
}

function loadAttendanceAuth() {
  const p = attendanceAuthPath();
  if (!fs.existsSync(p)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(p, 'utf-8'));
    const token = String(payload.access_token || '').trim();
    const workcode = String(payload.workcode || '').trim();
    if (!token || !workcode) return null;
    return {
      access_token: token,
      workcode,
      uuid: String(payload.uuid || fakeUuid()),
      client_version: String(payload.client_version || C.DEFAULT_CLIENT_VERSION),
      client_release: String(payload.client_release || ''),
      lon: String(payload.lon || `${C.OFFICE_BASE_LON}`),
      lat: String(payload.lat || `${C.OFFICE_BASE_LAT}`),
      geo_source: String(payload.geo_source || 'attendance-auth-cache'),
      device_source: String(payload.device_source || 'fake-device-profile'),
      auth_source: String(payload.auth_source || 'cached-attendance-auth'),
      auth_page_title: String(payload.auth_page_title || ''),
      auth_page_href: String(payload.auth_page_href || ''),
      session_source: String(payload.session_source || 'persisted-attendance-auth'),
    };
  } catch { return null; }
}

function saveAttendanceAuth(ctx) {
  atomicWriteJson(attendanceAuthPath(), {
    access_token: ctx.access_token,
    workcode: ctx.workcode,
    uuid: ctx.uuid,
    client_version: ctx.client_version,
    client_release: ctx.client_release,
    lon: ctx.lon,
    lat: ctx.lat,
    geo_source: ctx.geo_source,
    device_source: ctx.device_source,
    auth_source: ctx.auth_source,
    auth_page_title: ctx.auth_page_title,
    auth_page_href: ctx.auth_page_href,
    session_source: ctx.session_source,
    saved_at: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
  });
}

// ── 设备 ID ───────────────────────────────────────────────────────────────────

function machineSerial() {
  const linuxCandidates = [
    '/etc/machine-id',
    '/var/lib/dbus/machine-id',
    '/sys/class/dmi/id/product_uuid',
  ];
  for (const candidate of linuxCandidates) {
    try {
      const value = fs.readFileSync(candidate, 'utf-8').trim();
      if (value) return value;
    } catch { /* continue */ }
  }
  return `${os.hostname()}|${os.homedir()}`;
}

function fakeUuid() {
  const seed = `yachblade-attendance:${machineSerial()}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

// ── 两步换票：capi session → auth_code → clockin access_token ───────────────

function loginWithAuthCode(code) {
  const body = new URLSearchParams({ code }).toString();
  return C.httpPost(`${C.CLOCKIN_API_BASE}/login/code`, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

function contextFromLogin(login, opts = {}) {
  const data = login.data || {};
  const token = String(data.access_token || '').trim();
  const user = data.user || {};
  const workcode = String(user.workcode || '').trim();
  if (!token || !workcode) {
    throw new Error(`/login/code 缺 access_token/workcode：${JSON.stringify(login)}`);
  }
  const [lon, lat] = C.fakeOfficeGeo(C.OFFICE_GEO_SEED_METERS);
  return {
    access_token: token,
    workcode,
    uuid: fakeUuid(),
    client_version: C.DEFAULT_CLIENT_VERSION,
    client_release: os.release() || '',
    lon,
    lat,
    geo_source: 'office-seed-100m',
    device_source: 'fake-device-profile',
    auth_source: opts.authSource || 'qr-session-auth-code',
    auth_page_title: 'yach-attendance',
    auth_page_href: opts.authPageHref || '',
    session_source: opts.sessionSource || 'plugin-session-bootstrap',
  };
}

async function bootstrapPluginSessionAuthContext() {
  const session = C.loadPluginSession();
  if (!session) {
    throw new Error('当前没有可用的 Yach 会话，请先扫码登录。');
  }
  return _bootstrapAsync(session);
}

async function _bootstrapAsync(session) {
  const auth = await C.capiPost('/94capi/ucenter/auth/code', session, {});
  const code = String((auth.obj || {}).code || '').trim();
  if (Number(auth.code) !== 200 || !code) {
    throw new Error(`/94capi/ucenter/auth/code 失败：${JSON.stringify(auth)}`);
  }
  // Step 2: auth_code → clockin access_token
  const login = await loginWithAuthCode(code);
  if (Number(login.code) !== 200) {
    throw new Error(`/login/code 失败：${JSON.stringify(login)}`);
  }
  const ctx = contextFromLogin(login, {
    sessionSource: 'plugin-session-bootstrap',
    authSource: 'qr-session-auth-code',
    authPageHref: 'plugin-session',
  });
  saveAttendanceAuth(ctx);
  return ctx;
}

// ── 验证打卡 token 是否仍有效 ────────────────────────────────────────────────

async function validateAttendanceAuth(ctx) {
  try {
    const headers = C.authHeaders(ctx.access_token, ctx.workcode, ctx.client_version);
    const group = await C.clockinGet(C.groupPath(), ctx.access_token, ctx.workcode, ctx.client_version);
    return Number(group.code) === 200;
  } catch {
    return false;
  }
}

async function getAttendanceAuthContext() {
  const cached = loadAttendanceAuth();
  if (cached) {
    const valid = await validateAttendanceAuth(cached);
    if (valid) return cached;
  }
  const fresh = await _bootstrapAsync(C.loadPluginSession());
  saveAttendanceAuth(fresh);
  return fresh;
}

// ── 地理随机化解析 ───────────────────────────────────────────────────────────

async function resolveRandomizedGeo(ctx) {
  const headers = C.authHeaders(ctx.access_token, ctx.workcode, ctx.client_version);
  const seedLon = String(ctx.lon);
  const seedLat = String(ctx.lat);

  const seedLocation = await C.clockinGet(C.locationPath(seedLon, seedLat), ctx.access_token, ctx.workcode, ctx.client_version);

  let center = C.extractLocationCenter(seedLocation);
  let centerSource;
  if (center) {
    centerSource = 'location-response-coord';
  } else {
    center = [parseFloat(seedLon), parseFloat(seedLat)];
    centerSource = 'seed-fallback';
  }
  const [centerLon, centerLat] = center;

  const attempts = [];
  for (let i = 1; i <= C.RANDOMIZED_GEO_MAX_ATTEMPTS; i++) {
    const [lon, lat] = C.randomGeoAround(centerLon, centerLat, C.RANDOMIZED_GEO_RADIUS_METERS);
    const location = await C.clockinGet(C.locationPath(lon, lat), ctx.access_token, ctx.workcode, ctx.client_version);
    attempts.push({
      attempt: i, lon, lat,
      is_allow_clockin: !!((location || {}).data || {}).is_allow_clockin,
      dist: String(((location || {}).data || {}).dist || ''),
    });
    if (C.locationAllowsClockin(location)) {
      return { lon, lat, geoSource: `location-center-random-${C.RANDOMIZED_GEO_RADIUS_METERS}m`, location, seedLocation, centerLon, centerLat, centerSource, geoAttempts: attempts };
    }
  }

  // 中心点兜底
  const centerLonStr = `${centerLon}`;
  const centerLatStr = `${centerLat}`;
  const centerLocation = await C.clockinGet(C.locationPath(centerLonStr, centerLatStr), ctx.access_token, ctx.workcode, ctx.client_version);
  if (C.locationAllowsClockin(centerLocation)) {
    return { lon: centerLonStr, lat: centerLatStr, geoSource: 'location-center-fallback', location: centerLocation, seedLocation, centerLon: centerLonStr, centerLat: centerLatStr, centerSource, geoAttempts: attempts };
  }

  throw new Error(`无法在 location 中心点附近找到允许打卡的坐标：center=(${centerLonStr}, ${centerLatStr}), attempts=${JSON.stringify(attempts)}`);
}

// ── 主打卡流程 ────────────────────────────────────────────────────────────────

async function preparePunch(checkType, opts = {}) {
  const address = opts.address || '';
  const ctx = await getAttendanceAuthContext();
  const headers = C.authHeaders(ctx.access_token, ctx.workcode, ctx.client_version);

  // 1. 查排班
  const group = await C.clockinGet(C.groupPath(), ctx.access_token, ctx.workcode, ctx.client_version);
  const data = (group || {}).data || {};
  const schedule = data.schedule || [];
  let candidates = schedule.filter(x => x.check_type === checkType);
  if (candidates.length === 0) {
    // 无排班项（休息日），尝试自由打卡
    candidates = [{ check_type: checkType, has_record: false, record: null, is_current: true }];
  }

  const serverDate = String((data.date || {}).date || '');
  const serverTime = String((data.date || {}).time || '');

  // 2. 在任何地理定位或写卡预检前检查已有记录，避免无意义的外部请求。
  const candidateStatuses = candidates.map(c => C.classifyScheduleRecord(c));
  const blockingStatus = candidateStatuses.find(s => s.countsAsCompleted) || null;
  const provisionalStatus = candidateStatuses.find(s => s.isProvisional) || null;
  const guard = C.writeGuard(checkType, blockingStatus, provisionalStatus);
  if (guard.requiresForce && !opts.force) {
    throw new Error(`${guard.reason} 若确认要覆盖，请加 force=true。`);
  }

  // 3. 随机地理
  const geo = await resolveRandomizedGeo(ctx);
  ctx.lon = geo.lon;
  ctx.lat = geo.lat;
  ctx.geo_source = geo.geoSource;
  saveAttendanceAuth(ctx);

  // 4. 预检 /api/time/result
  const preferred = [];
  const currentItem = candidates.find(x => x.is_current === true);
  if (currentItem) preferred.push(currentItem);
  preferred.push(...candidates.filter(x => !x.has_record && !preferred.includes(x)));
  preferred.push(...candidates.filter(x => x.record && !preferred.includes(x)));

  let item = null;
  let record = {};
  let hasRecord = false;
  let msgId = '0';
  let checkDateTime = '';
  let timeResult = null;
  const probeErrors = [];

  for (const probeItem of preferred) {
    const probeRecord = probeItem.record || {};
    const probeHasRecord = !!(probeItem.has_record && probeRecord && Object.keys(probeRecord).length > 0);
    const probeMsgId = String((probeHasRecord ? probeRecord.msg_id : 0) || 0);
    const probeCheckDateTime = probeHasRecord ? '' : `${serverDate} ${serverTime}`.trim();
    try {
      const probeTime = await C.clockinPost('/api/time/result', { msg_id: probeMsgId }, ctx.access_token, ctx.workcode, ctx.client_version);
      item = probeItem;
      record = probeRecord;
      hasRecord = probeHasRecord;
      msgId = probeMsgId;
      checkDateTime = probeCheckDateTime;
      timeResult = probeTime;
      break;
    } catch (e) {
      probeErrors.push({ msg_id: probeMsgId, error: e.message });
    }
  }

  if (!item) {
    throw new Error(`${checkType} 所有候选排班项都没通过 /api/time/result 预检：${JSON.stringify(probeErrors)}`);
  }

  // 5. RSA 加密 crc
  const resolvedAddress = address.trim() || String(record.address || '').trim() || C.OFFICE_DEFAULT_ADDRESS;
  const crcPlaintext = `${ctx.lat}|${checkDateTime}|${ctx.lon}`;
  const crc = C.rsaPkcs1EncryptHex(crcPlaintext);

  const recordFields = {
    work_date: C.workDateStr(),
    check_date_time: checkDateTime,
    check_type: checkType,
    user_address: resolvedAddress,
    lon: ctx.lon,
    lat: ctx.lat,
    device_id: ctx.uuid,
    brand: C.FAKE_BRAND,
    model: C.FAKE_MODEL,
    version: C.FAKE_VERSION,
    net_info: C.FAKE_NET_INFO,
    operator_type: '',
    user_ssid: '',
    user_mac_addr: '',
    outside_remark: '',
    msg_id: msgId,
    crc,
  };

  return {
    ctx, headers, workDate: C.workDateStr(),
    item, record, hasRecord,
    writeGuard: { requiresForce: guard.requiresForce, reason: guard.reason },
    msgId, serverDate, serverTime, checkDateTime, resolvedAddress,
    geoSource: geo.geoSource, geoAttempts: geo.geoAttempts,
    timeResult, crcPlaintext, crc, recordFields,
  };
}

async function doPunch(checkType, opts = {}) {
  const { address = '', force = false } = opts;
  const prepared = await preparePunch(checkType, { address, force });

  if (prepared.writeGuard.requiresForce && !force) {
    throw new Error(`${prepared.writeGuard.reason} 若确认要覆盖，请加 force=true。`);
  }

  // 6. 写卡 /api/record
  const recordResp = await C.clockinPost('/api/record', prepared.recordFields, prepared.ctx.access_token, prepared.ctx.workcode, prepared.ctx.client_version);

  // 7. 回读验证
  const groupAfter = await C.clockinGet(`/api/group?work_date=${encodeURIComponent(prepared.workDate)}`, prepared.ctx.access_token, prepared.ctx.workcode, prepared.ctx.client_version);
  const scheduleAfter = (((groupAfter || {}).data || {}).schedule) || [];
  const afterCandidates = scheduleAfter.filter(x => x.check_type === checkType);
  const afterItem =
    afterCandidates.find(x => x.is_current === true) ||
    afterCandidates.find(x => x.record) ||
    (afterCandidates[0] || null);
  const afterRecord = (afterItem || {}).record || {};

  if (!String(afterRecord.check_time || '').trim()) {
    throw new Error(`${checkType} 写卡后回读 check_time 缺失。before=${JSON.stringify(prepared.record)}`);
  }

  return {
    check_type: checkType,
    geo_source: prepared.ctx.geo_source,
    session_source: prepared.ctx.session_source,
    auth_source: prepared.ctx.auth_source,
    used_lon: prepared.ctx.lon,
    used_lat: prepared.ctx.lat,
    record: recordResp,
    after: afterRecord,
  };
}

// ── 导出 ──────────────────────────────────────────────────────────────────────

module.exports = {
  doPunch,
  preparePunch,
  getAttendanceAuthContext,
  validateAttendanceAuth,
  bootstrapPluginSessionAuthContext,
  loadAttendanceAuth,
  saveAttendanceAuth,
};
