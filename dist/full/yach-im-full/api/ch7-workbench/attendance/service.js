/**
 * 知音楼打卡业务逻辑。
 *
 * 认证与写卡均要求调用方显式提供本次操作的真实坐标和设备信息。
 * 本模块不读取系统硬件标识，不从主机名推导设备信息，也不替调用方选择坐标。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { URLSearchParams } = require('url');

const C = require('./client.js');

// ── 状态持久化 ────────────────────────────────────────────────────────────────

function stateDir() {
  const candidates = [
    process.env.YACH_STATE_DIR,
    path.join(os.homedir(), '.openclaw/workspace-yach/sessions'),
    path.resolve(__dirname, '../../../../sessions'),
  ].filter(Boolean);
  for (const d of candidates) {
    try {
      const resolved = path.resolve(d);
      fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
      return resolved;
    } catch { /* try the next state directory */ }
  }
  return path.resolve(__dirname, '../../../../sessions');
}

function attendanceAuthPath() {
  return path.join(stateDir(), 'attendance-auth.json');
}

function atomicWriteJson(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, filePath);
  fs.chmodSync(filePath, 0o600);
}

function loadAttendanceAuth() {
  const filePath = attendanceAuthPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const accessToken = String(payload.access_token || '').trim();
    const workcode = String(payload.workcode || '').trim();
    if (!accessToken || !workcode) return null;
    return {
      access_token: accessToken,
      workcode,
      uuid: String(payload.uuid || payload.device_id || '').trim(),
      device_id: String(payload.device_id || payload.uuid || '').trim(),
      device_name: String(payload.device_name || '').trim(),
      device_brand: String(payload.device_brand || '').trim(),
      device_model: String(payload.device_model || '').trim(),
      device_version: String(payload.device_version || '').trim(),
      network_type: String(payload.network_type || '').trim(),
      system_version: String(payload.system_version || '').trim(),
      platform: String(payload.platform || '').trim(),
      client_version: String(payload.client_version || C.DEFAULT_CLIENT_VERSION),
      client_release: String(payload.client_release || '').trim(),
      lon: String(payload.lon || '').trim(),
      lat: String(payload.lat || '').trim(),
      geo_source: String(payload.geo_source || 'caller-provided'),
      device_source: String(payload.device_source || 'caller-provided'),
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
    device_id: ctx.device_id || ctx.uuid,
    device_name: ctx.device_name,
    device_brand: ctx.device_brand,
    device_model: ctx.device_model,
    device_version: ctx.device_version,
    network_type: ctx.network_type,
    system_version: ctx.system_version,
    platform: ctx.platform,
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
    saved_at: new Date().toISOString(),
  });
}

// ── 两步换票：capi session → auth_code → clockin access_token ───────────────

function loginWithAuthCode(code) {
  const body = new URLSearchParams({ code }).toString();
  return C.httpPost(`${C.CLOCKIN_API_BASE}/login/code`, body, {
    'Content-Type': 'application/x-www-form-urlencoded',
  });
}

function normalizeAttendanceInput(opts = {}) {
  const longitude = Number(opts.longitude ?? opts.lon);
  const latitude = Number(opts.latitude ?? opts.lat);
  const deviceId = String(opts.deviceId || '').trim();
  const deviceName = String(opts.deviceName || '').trim();
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('考勤操作必须提供有效的 longitude（-180 到 180），不会使用默认坐标。');
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('考勤操作必须提供有效的 latitude（-90 到 90），不会使用默认坐标。');
  }
  if (!deviceId || !deviceName) {
    throw new Error('考勤操作必须由调用方显式提供 deviceId 和 deviceName，不会从系统读取或构造设备标识。');
  }
  return {
    longitude: String(longitude),
    latitude: String(latitude),
    deviceId,
    deviceName,
    deviceBrand: String(opts.deviceBrand || '').trim(),
    deviceModel: String(opts.deviceModel || '').trim(),
    deviceVersion: String(opts.deviceVersion || '').trim(),
    networkType: String(opts.networkType || '').trim(),
    systemVersion: String(opts.systemVersion || '').trim(),
    platform: String(opts.platform || '').trim(),
    clientVersion: String(opts.clientVersion || C.DEFAULT_CLIENT_VERSION).trim(),
    clientRelease: String(opts.clientRelease || '').trim(),
  };
}

function applyAttendanceInput(ctx, input) {
  return {
    ...ctx,
    uuid: input.deviceId,
    device_id: input.deviceId,
    device_name: input.deviceName,
    device_brand: input.deviceBrand,
    device_model: input.deviceModel,
    device_version: input.deviceVersion,
    network_type: input.networkType,
    system_version: input.systemVersion,
    platform: input.platform,
    client_version: input.clientVersion,
    client_release: input.clientRelease,
    lon: input.longitude,
    lat: input.latitude,
    geo_source: 'caller-provided',
    device_source: 'caller-provided',
  };
}

function contextFromLogin(login, input, opts = {}) {
  const data = login.data || {};
  const token = String(data.access_token || '').trim();
  const user = data.user || {};
  const workcode = String(user.workcode || '').trim();
  if (!token || !workcode) {
    throw new Error(`/login/code 缺 access_token/workcode：${JSON.stringify(login)}`);
  }
  return {
    access_token: token,
    workcode,
    uuid: input.deviceId,
    device_id: input.deviceId,
    device_name: input.deviceName,
    device_brand: input.deviceBrand,
    device_model: input.deviceModel,
    device_version: input.deviceVersion,
    network_type: input.networkType,
    system_version: input.systemVersion,
    platform: input.platform,
    client_version: input.clientVersion,
    client_release: input.clientRelease,
    lon: input.longitude,
    lat: input.latitude,
    geo_source: 'caller-provided',
    device_source: 'caller-provided',
    auth_source: opts.authSource || 'qr-session-auth-code',
    auth_page_title: 'yach-attendance',
    auth_page_href: opts.authPageHref || '',
    session_source: opts.sessionSource || 'plugin-session-bootstrap',
  };
}

async function bootstrapPluginSessionAuthContext(opts = {}) {
  const input = normalizeAttendanceInput(opts);
  const session = C.loadPluginSession(input);
  if (!session) throw new Error('当前没有可用的 Yach 会话，请先扫码登录。');
  return _bootstrapAsync(session, input);
}

async function _bootstrapAsync(session, input) {
  const auth = await C.capiPost('/94capi/ucenter/auth/code', session, {});
  const code = String((auth.obj || {}).code || '').trim();
  if (Number(auth.code) !== 200 || !code) {
    throw new Error(`/94capi/ucenter/auth/code 失败：${JSON.stringify(auth)}`);
  }
  const login = await loginWithAuthCode(code);
  if (Number(login.code) !== 200) {
    throw new Error(`/login/code 失败：${JSON.stringify(login)}`);
  }
  const ctx = contextFromLogin(login, input, {
    sessionSource: 'plugin-session-bootstrap',
    authSource: 'qr-session-auth-code',
    authPageHref: 'plugin-session',
  });
  saveAttendanceAuth(ctx);
  return ctx;
}

async function validateAttendanceAuth(ctx) {
  try {
    const group = await C.clockinGet(C.groupPath(), ctx.access_token, ctx.workcode, ctx.client_version);
    return Number(group.code) === 200;
  } catch {
    return false;
  }
}

async function getAttendanceAuthContext(opts = {}) {
  const input = normalizeAttendanceInput(opts);
  const cached = loadAttendanceAuth();
  if (cached && await validateAttendanceAuth(cached)) {
    return applyAttendanceInput(cached, input);
  }
  const session = C.loadPluginSession(input);
  if (!session) throw new Error('当前没有可用的 Yach 会话，请先扫码登录。');
  const fresh = await _bootstrapAsync(session, input);
  saveAttendanceAuth(fresh);
  return fresh;
}

// ── 调用方坐标校验 ────────────────────────────────────────────────────────────

async function resolveProvidedGeo(ctx) {
  const lon = String(ctx.lon);
  const lat = String(ctx.lat);
  const location = await C.clockinGet(C.locationPath(lon, lat), ctx.access_token, ctx.workcode, ctx.client_version);
  if (C.locationAllowsClockin(location)) {
    return { lon, lat, geoSource: 'caller-provided', location, geoAttempts: [{ attempt: 1, lon, lat, is_allow_clockin: true }] };
  }
  throw new Error(`调用方提供的坐标不在服务端允许打卡范围内：(${lon}, ${lat})`);
}

// ── 主打卡流程 ────────────────────────────────────────────────────────────────

async function preparePunch(checkType, opts = {}) {
  const input = normalizeAttendanceInput(opts);
  const address = String(opts.address || '').trim();
  const ctx = applyAttendanceInput(await getAttendanceAuthContext(input), input);
  const headers = C.authHeaders(ctx.access_token, ctx.workcode, ctx.client_version);

  const group = await C.clockinGet(C.groupPath(), ctx.access_token, ctx.workcode, ctx.client_version);
  const data = (group || {}).data || {};
  const schedule = data.schedule || [];
  let candidates = schedule.filter(x => x.check_type === checkType);
  if (candidates.length === 0) {
    candidates = [{ check_type: checkType, has_record: false, record: null, is_current: true }];
  }

  const serverDate = String((data.date || {}).date || '');
  const serverTime = String((data.date || {}).time || '');
  const candidateStatuses = candidates.map(c => C.classifyScheduleRecord(c));
  const blockingStatus = candidateStatuses.find(s => s.countsAsCompleted) || null;
  const provisionalStatus = candidateStatuses.find(s => s.isProvisional) || null;
  const guard = C.writeGuard(checkType, blockingStatus, provisionalStatus);
  if (guard.requiresForce && !opts.force) {
    throw new Error(`${guard.reason} 若确认要覆盖，请加 force=true。`);
  }

  const geo = await resolveProvidedGeo(ctx);
  ctx.lon = geo.lon;
  ctx.lat = geo.lat;
  ctx.geo_source = geo.geoSource;
  saveAttendanceAuth(ctx);

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

  const resolvedAddress = address || String(record.address || '').trim();
  const crcPlaintext = `${ctx.lat}|${checkDateTime}|${ctx.lon}`;
  const crc = C.rsaPkcs1EncryptHex(crcPlaintext);
  const recordFields = {
    work_date: C.workDateStr(),
    check_date_time: checkDateTime,
    check_type: checkType,
    user_address: resolvedAddress,
    lon: ctx.lon,
    lat: ctx.lat,
    device_id: ctx.device_id || ctx.uuid,
    brand: ctx.device_brand,
    model: ctx.device_model,
    version: ctx.device_version,
    net_info: ctx.network_type,
    operator_type: '',
    user_ssid: '',
    user_mac_addr: '',
    outside_remark: '',
    msg_id: msgId,
    crc,
  };

  return {
    ctx, headers, workDate: C.workDateStr(), item, record, hasRecord,
    writeGuard: { requiresForce: guard.requiresForce, reason: guard.reason },
    msgId, serverDate, serverTime, checkDateTime, resolvedAddress,
    geoSource: geo.geoSource, geoAttempts: geo.geoAttempts,
    timeResult, crcPlaintext, crc, recordFields,
  };
}

async function doPunch(checkType, opts = {}) {
  const prepared = await preparePunch(checkType, opts);
  if (prepared.writeGuard.requiresForce && !opts.force) {
    throw new Error(`${prepared.writeGuard.reason} 若确认要覆盖，请加 force=true。`);
  }

  const recordResp = await C.clockinPost('/api/record', prepared.recordFields, prepared.ctx.access_token, prepared.ctx.workcode, prepared.ctx.client_version);
  const groupAfter = await C.clockinGet(`/api/group?work_date=${encodeURIComponent(prepared.workDate)}`, prepared.ctx.access_token, prepared.ctx.workcode, prepared.ctx.client_version);
  const scheduleAfter = (((groupAfter || {}).data || {}).schedule) || [];
  const afterCandidates = scheduleAfter.filter(x => x.check_type === checkType);
  const afterItem = afterCandidates.find(x => x.is_current === true) || afterCandidates.find(x => x.record) || (afterCandidates[0] || null);
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

module.exports = {
  doPunch,
  preparePunch,
  getAttendanceAuthContext,
  validateAttendanceAuth,
  bootstrapPluginSessionAuthContext,
  loadAttendanceAuth,
  saveAttendanceAuth,
};
