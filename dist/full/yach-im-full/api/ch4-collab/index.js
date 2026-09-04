/**
 * 第四章：协同办公与日程
 * 已真调验证（2026-07-12 完整生命周期）：
 *   getScheduleList  ✅ 913scd/schedule/v2/events/vlist GET (start_time, end_time 秒)
 *   getRecentMeetings✅ 913scd/schedule/api/rooms/recent_meeting GET
 *   createSchedule   ✅ 913scd/schedule/events/create POST {title,start_time(秒),end_time(秒),joiner[],repeat}
 *   deleteSchedule   ✅ 913scd/schedule/events/delete POST {id:<sid>,scope:3,refuse:0}
 * ⭐ 完整闭环真调通过：创建→列表可见→删除→列表消失。
 * ⭐ 坑：创建返回的 id 带后缀（如 laGcRgEAwB0**65516**），但列表/删除要用 **sid**（laGcRgMAwB0）；
 *   删除缺 scope 报 30014，用错 id 值报 30012。
 */
const { get, post } = require('../../utils/request');
const meetingRoom = require('./meeting-room/service');

/**
 * 获取日程列表
 * @param {Date|number} startDate 开始时间 (Date 对象或毫秒时间戳)
 * @param {Date|number} endDate   结束时间
 */
async function getScheduleList(startDate, endDate) {
  const toSec = d => Math.floor((d instanceof Date ? d.getTime() : d) / 1000);
  const r = await get('913scd/schedule/v2/events/vlist', {
    start_time: toSec(startDate),
    end_time:   toSec(endDate),
    cp_id: 1,
  });
  if (r.code !== 200) throw new Error(`getScheduleList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取今天 + 未来7天的日程
 */
async function getUpcomingSchedules(days = 7) {
  const now = Date.now();
  return getScheduleList(now, now + days * 24 * 3600 * 1000);
}

function _scheduleItems(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.list)) return result.list;
  if (Array.isArray(result?.events)) return result.events;
  return [];
}

function _scheduleSid(value) {
  if (!value || typeof value !== 'object') return '';
  return String(value.sid ?? value.event_id ?? value.schedule_id ?? value.id ?? '').trim();
}

function _matchingScheduleSid(result, expected, previousSid = '') {
  const title = String(expected.title || '');
  const start = Number(expected.start_time) || 0;
  const end = Number(expected.end_time) || 0;
  const creator = _eventUid(expected.creator);
  const matches = _scheduleItems(result).filter(item => {
    if (title && String(item.title || '') !== title) return false;
    if (start && Number(item.begin_time ?? item.start_time) !== start) return false;
    if (end && Number(item.finish_time ?? item.end_time) !== end) return false;
    if (creator != null) {
      const itemCreator = _eventUid(item.creator ?? item.uid);
      if (itemCreator != null && itemCreator !== creator) return false;
    }
    return Boolean(_scheduleSid(item));
  });
  const changed = matches.find(item => _scheduleSid(item) !== String(previousSid || ''));
  return _scheduleSid(changed || matches[0]);
}

async function _recoverScheduleSid(expected, previousSid = '') {
  const start = Number(expected.start_time) || Math.floor(Date.now() / 1000);
  const end = Number(expected.end_time) || start + 3600;
  const result = await getScheduleList((start - 43200) * 1000, (end + 43200) * 1000);
  return _matchingScheduleSid(result, expected, previousSid);
}

/**
 * 创建日程（写操作）。
 * 实测 events/create 会忽略 joiner；有参与人时先创建，再用 updateSchedule 的
 * participant 参数整体替换参与人。update 可能生成新 sid，因此最终返回回读后的 sid。
 * @param {object} params { title, start_time(秒时间戳), end_time(秒), joiner:[uid...], repeat }
 * ⚠️ start_time/end_time 用**秒时间戳**（非毫秒、非字符串）；joiner 传数组（内部自动 JSON.stringify）。
 * @returns {object} { id, sid, tid, aid, ... } —— ⚠️ 后续删除要用列表/返回里的 **sid**（不是 id）
 */
async function createSchedule(params = {}) {
  const requestedJoiners = Array.isArray(params.joiner) ? params.joiner : [];
  const body = { cp_id: 1, repeat: '0', ...params };
  delete body.joiner;
  const r = await post('913scd/schedule/events/create', body);
  if (r.code !== 200) throw new Error(`createSchedule failed: ${r.code} ${r.msg}`);
  const created = r.obj || {};
  const responseSid = _scheduleSid(created);
  let recoveredSid = '';
  try {
    recoveredSid = await _recoverScheduleSid({
      title: body.title,
      start_time: body.start_time,
      end_time: body.end_time,
    });
  } catch {
    // 创建写入已经成功；列表回读失败时再使用创建响应中的标识。
  }
  const initialSid = recoveredSid || responseSid;
  if (!initialSid) throw new Error('createSchedule: 创建成功但无法解析或回读日程 sid');

  if (requestedJoiners.length === 0) {
    return { ...created, sid: initialSid, initial_sid: initialSid, sid_changed: false };
  }

  const updated = await updateSchedule(initialSid, { joiner: requestedJoiners });
  return {
    ...created,
    ...updated,
    initial_sid: initialSid,
    sid: updated.sid,
    sid_changed: updated.sid !== initialSid,
  };
}

/**
 * 删除日程（写操作）——真调验证通
 * @param {string} scheduleId 日程 id（用**列表/创建返回里的 sid**，不是带后缀的 id）
 * @param {object} opts { scope:3(全部)|1|0, refuse:0 }
 * ⚠️ 真实参数（home.js 逆出）= {id, scope, refuse}；缺 scope 报 30014，用错 id 值报 30012。
 */
async function deleteSchedule(scheduleId, opts = {}) {
  const r = await post('913scd/schedule/events/delete', {
    id: String(scheduleId),
    scope: opts.scope ?? 3,
    refuse: opts.refuse ?? 0,
    cp_id: 1,
  });
  if (r.code !== 200) throw new Error(`deleteSchedule failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 接受或拒绝日程邀请。state: 1=接受，2=拒绝。
 */
async function respondToSchedule(scheduleId, state, reason = '') {
  const normalizedState = Number(state);
  if (![1, 2].includes(normalizedState)) throw new Error('respondToSchedule: state 必须是 1（接受）或 2（拒绝）');
  const body = { id: String(scheduleId), state: normalizedState, cp_id: 1 };
  if (reason) body.refuse_reason = String(reason);
  const r = await post('913scd/schedule/events/feedback', body);
  if (r.code !== 200) throw new Error(`respondToSchedule failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 查单个日程详情（真调验证 2026-07-13）
 * 路由：913scd/schedule/events/info GET {id, source:1, aid, from, share_uid}
 * 返回日程完整字段（title/location/creator/begin_time/finish_time/participant/repeat 等）。
 * @param {string} eventId 日程 id（vlist/create 返回里的 id/sid）
 */
async function getScheduleDetail(eventId, opts = {}) {
  const r = await get('913scd/schedule/events/info', {
    id: String(eventId),
    source: opts.source ?? 1,
    aid: '', from: '', share_uid: '',
    cp_id: 1,
  });
  if (r.code !== 200) throw new Error(`getScheduleDetail failed: ${r.code} ${r.msg}`);
  return r.obj;
}

function _eventUid(u) { const n = Number(u); return Number.isFinite(n) ? n : null; }
function _uniqUids(arr) {
  const out = []; const seen = new Set();
  for (const u of arr) { const n = _eventUid(u); if (n != null && !seen.has(n)) { seen.add(n); out.push(n); } }
  return out;
}
function _participantUids(current) {
  // 从 info 详情里抽参与人 uid（兼容 joiner/participant/joiner_list 等形态）
  const cands = current.joiner || current.participant || current.joiner_list || current.members || [];
  const arr = Array.isArray(cands) ? cands : String(cands).split(',');
  return _uniqUids(arr.map(x => (x && typeof x === 'object') ? (x.uid ?? x.id ?? x.user_id) : x));
}

/**
 * 更新（编辑）已有日程（写操作）—— 逆向自 legacy update_event
 * 关键：知音楼客户端保存编辑仍走 events/create，只是额外带 id。
 * 先读原日程详情（getScheduleDetail）带全字段，只覆盖传入的字段，避免丢掉原有信息。
 * @param {string} eventId 待更新的日程 id
 * @param {object} patch { title?, start_time?(秒), end_time?(秒), joiner?:[uid...], address?, remark?, remind_time?, visibility?, repeat? }
 * @returns {object} create 返回 obj
 */
async function updateSchedule(eventId, patch = {}) {
  const current = await getScheduleDetail(eventId);
  if (!current) throw new Error(`updateSchedule: 找不到日程 ${eventId}`);
  const creator = _eventUid(current.creator) ?? _eventUid(current.uid);
  const beginTs = Number(current.begin_time) || 0;
  const finishTs = Number(current.finish_time) || 0;
  if (!beginTs || !finishTs) throw new Error(`updateSchedule: 日程缺有效时间 ${eventId}`);

  let participantIds;
  if (patch.joiner != null) {
    participantIds = _uniqUids([creator, ...(Array.isArray(patch.joiner) ? patch.joiner : [patch.joiner])]);
  } else {
    participantIds = _uniqUids([creator, ..._participantUids(current)]);
  }

  const scope = patch.visibility != null ? Number(patch.visibility) : (Number(current.visibility) || 1);
  const meeting = current.meeting || {};
  const body = {
    title: patch.title != null ? patch.title : String(current.title || ''),
    document_param: current.document_param || '{}',
    start_time: patch.start_time != null ? Number(patch.start_time) : beginTs,
    end_time: patch.end_time != null ? Number(patch.end_time) : finishTs,
    participant: participantIds.join(','),
    address: patch.address != null ? patch.address : (current.location || ''),
    is_full: current.is_full ? 1 : 0,
    invite_type: Number(current.invite_type) || 1,
    attachment_info: '',
    remark: patch.remark != null ? patch.remark : (current.summary || ''),
    remind_time: patch.remind_time != null ? Number(patch.remind_time) : (Number(current.remind_time) || 300),
    id: String(eventId),
    repeat: patch.repeat != null ? Number(patch.repeat) : (Number(current.repeat_value) || 0),
    repeat_end_time: Number(current.repeat_end_time) || '',
    repeat_custom: '',
    scope,
    meeting_type: Number(meeting.type) || 1,
    server_type: Number(meeting.server_type) || 2,
    book_meeting: Number(meeting.book_meeting) || 0,
    creator,
    visibility: scope,
    timezone: 8,
    auto_record_type: Number(meeting.auto_record_type) || 0,
    sync_recording: Number(meeting.sync_recording) || 0,
    cp_id: 1,
  };
  const r = await post('913scd/schedule/events/create', body);
  if (r.code !== 200) throw new Error(`updateSchedule failed: ${r.code} ${r.msg}`);
  const updated = r.obj || {};
  const responseSid = _scheduleSid(updated);
  let recoveredSid = '';
  try {
    recoveredSid = await _recoverScheduleSid({
      title: body.title,
      start_time: body.start_time,
      end_time: body.end_time,
      creator,
    }, eventId);
  } catch {
    // 写入已成功；列表回读失败时保留服务端返回 ID，并标记解析来源。
  }
  const sid = recoveredSid || responseSid || String(eventId);
  return {
    ...updated,
    sid,
    previous_sid: String(eventId),
    sid_changed: sid !== String(eventId),
    sid_resolution: recoveredSid ? 'schedule-list' : responseSid ? 'update-response' : 'previous-sid-fallback',
  };
}

/**
 * ⭐ 日程冲突检测（真调验证 2026-07-13）
 * 路由：913scd/schedule/events/conflict POST(form)
 *   入参：{start_time(秒), end_time(秒), uids(逗号分隔 uid), id(可空), contain_share_cps:1, filter:1}
 *   返回：{count, leaves:[请假人 uid], conflicts:[有冲突 uid], ranges:[[start,end],...]}
 * 来自 legacy yach-schedule check_conflict，改写为我们的 capi 签名 post（不需 CDP）。
 * @param {object} p {startTime, endTime, uids:[uid...], eventId?}
 */
async function checkScheduleConflict(p = {}) {
  const toSec = d => Math.floor((d instanceof Date ? d.getTime() : Number(d)) / 1000);
  const uids = (Array.isArray(p.uids) ? p.uids : [p.uids]).filter(Boolean).map(String).join(',');
  const r = await post('913scd/schedule/events/conflict', {
    start_time: toSec(p.startTime),
    end_time: toSec(p.endTime),
    uids,
    id: p.eventId || '',
    contain_share_cps: 1,
    filter: 1,
    cp_id: 1,
  });
  if (r.code !== 200) throw new Error(`checkScheduleConflict failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * ⭐ 推荐参与人共同空闲时段（真调验证 2026-07-13）
 * 路由：913scd/schedule/events/recommend/freetime POST(form)
 *   入参：{start_time(秒), end_time(秒), uids(逗号分隔), id(可空)}
 *   返回：空闲时段结构；无合适时时 msg=“最近5个工作日内没有合适的时间…”、obj={}
 * 来自 legacy yach-schedule recommend_freetime。
 * @param {object} p {startTime, endTime, uids:[uid...], eventId?}
 */
async function recommendFreetime(p = {}) {
  const toSec = d => Math.floor((d instanceof Date ? d.getTime() : Number(d)) / 1000);
  const uids = (Array.isArray(p.uids) ? p.uids : [p.uids]).filter(Boolean).map(String).join(',');
  const r = await post('913scd/schedule/events/recommend/freetime', {
    start_time: toSec(p.startTime),
    end_time: toSec(p.endTime),
    uids,
    id: p.eventId || '',
    cp_id: 1,
  });
  if (r.code !== 200) throw new Error(`recommendFreetime failed: ${r.code} ${r.msg}`);
  return { msg: r.msg || '', obj: r.obj };
}

/**
 * 最近会议（会议室）
 * 路由：schedule/api/rooms/recent_meeting（scheduleRecentMeeting）
 */
async function getRecentMeetings(opts = {}) {
  const r = await get('913scd/schedule/api/rooms/recent_meeting', { cp_id: 1, ...opts });
  if (r.code !== 200) throw new Error(`getRecentMeetings failed: ${r.code} ${r.msg}`);
  return r.obj;
}

// ── 会议（诚实标注：不可用）──
// 实测结论（2026-07-12）：会议路由前缀 link 到主 capi 网关返回 403“不存在的接入方式”/
// 10011“不支持的路由”——会议接口**不在主 capi**，走独立会议服务域名（逆向包未给完整映射），
// 且实际音视频通话依赖云信/腾讯会议 SDK。纯 HTTP + 主 capi 做不了，需运行时抓包拿会议域名。
const _meetingNotAvail = (name) => {
  throw new Error(`[ch4:${name}] 会议接口不在主 capi 网关（实测 403/10011），走独立会议域名 + 云信/腾讯会议 SDK，需运行时抓包还原后才能实现。`);
};
async function getMeetingUsers() { return _meetingNotAvail('getMeetingUsers'); }
async function createMeeting()  { return _meetingNotAvail('createMeeting'); }

/**
 * ⭐ 工作台应用列表（真调验证 2026-07-13）
 * 路由：`95search/app/user/list`（home.js cn.T$.appListOnSideBar，base=95search）
 *   入参：{page, size}；返回 {total, sum_page, page, page_size, app_list:[{prefix, list:[{app_name, app_id, app_redirect, app_open_way, ...}]}]}
 *   app_open_way "0"=WebView 打开 app_redirect（多为 sso.100tal.com/login/<app_id> 单点登录到微应用）。
 * 实测：本账号 163 个应用，含“会议室预约”(app_id=978353613)、“加班餐预订”、“排队预约”等。
 * @param {object} opts {page=1, size=100}
 * @returns {Promise<Array>} 扁平化后的应用数组（已展开 app_list 分组）
 */
async function listWorkbenchApps(opts = {}) {
  const size = opts.size ?? 100;
  const maxPage = opts.maxPage ?? 3;
  const all = [];
  for (let page = opts.page ?? 1; page <= maxPage; page++) {
    const r = await post('95search/app/user/list', { page, size });
    if (r.code !== 200) throw new Error(`listWorkbenchApps failed: ${r.code} ${r.msg}`);
    const groups = (r.obj && r.obj.app_list) || [];
    for (const g of groups) if (g && Array.isArray(g.list)) all.push(...g.list);
    if (!r.obj || page >= (r.obj.sum_page || 1)) break;
  }
  return all;
}

/**
 * ⭐ 会议室预约（订会议室）入口（真调验证 2026-07-13）
 *
 * 诚实结论（已穷尽式逆向 + 真调）：“订会议室”在知音楼主 capi 网关上
 *   **没有原生预订 REST 接口**。全 render 层只有 `schedule/api/rooms/recent_meeting`（
 *   只读最近会议）和 `/client/rooms/call`（音视频），无 room list / room book 路由。
 *   会议室预约是一个通过 SSO 单点登录打开的微应用（app_open_way=0），
 *   实际预订发生在 app_redirect 背后的 H5 内（sso.100tal.com 登录后）。
 *
 * 本函数不假装能“下单预定”——它真调工作台应用列表，返回会议室预约应用的
 * **真实启动地址 + 元数据**，供上层引导用户打开预约页。
 * @returns {Promise<object>} {found, app_name, app_id, url, open_way, note}
 */
async function getMeetingRoomEntry() {
  const apps = await listWorkbenchApps({ maxPage: 3 });
  const room = apps.find(a => /会议室/.test(a.app_name || '') || /meeting[_ ]?room/i.test(a.app_name_en || ''));
  if (!room) {
    return { found: false, note: '当前账号工作台无“会议室预约”应用（共 ' + apps.length + ' 个应用）。' };
  }
  return {
    found: true,
    app_name: room.app_name,
    app_id: room.app_id,
    url: room.app_redirect_pc || room.app_redirect,
    open_way: room.app_open_way, // "0"=WebView
    note: '会议室预约是 SSO 单点登录的微应用，主 capi 无原生预订接口；打开此 url 在浏览器/WebView 内完成预订。',
  };
}

/**
 * ⭐⭐ 会议室预约（真调打通 2026-07-13）
 * 推翻了上面 getMeetingRoomEntry 的“主 capi 做不了”结论：会议室预约**不用浏览器**，
 * 走一条纯 HTTP 的好未来统一登录链（auth/code → controller/sso 重定向 → huiyi.tal.com），
 * 之后所有业务接口在 huiyi.tal.com/prod-api/meeting/*。
 * 实现在 ./meeting-room/{client,service,store}.js；SSO+搜房+查占用均真调验证。
 *
 *   searchMeetingRooms({date,start,end,office?,city?,keyword?})  ✅ 搜空闲房
 *   readMeetingRoomBookings({roomQuery,date,office?,city?})       ✅ 查某房占用
 *   bookMeetingRoom({date,start,end,roomQuery,title,office?,city?,remark?})  写：订房
 *   cancelMeetingRoom({meetingId})                                写：取消
 */
async function searchMeetingRooms(params) { return meetingRoom.searchMeetingRooms(params); }
async function readMeetingRoomBookings(params) { return meetingRoom.readMeetingRoomBookings(params); }
async function bookMeetingRoom(params) { return meetingRoom.bookMeetingRoom(params); }
async function cancelMeetingRoom(params) { return meetingRoom.cancelMeetingRoom(params); }

module.exports = {
  getScheduleList, getUpcomingSchedules, createSchedule,
  deleteSchedule, respondToSchedule, getScheduleDetail, updateSchedule,
  _scheduleItems, _scheduleSid, _matchingScheduleSid,
  getRecentMeetings, getMeetingUsers, createMeeting,
  checkScheduleConflict, recommendFreetime,
  listWorkbenchApps, getMeetingRoomEntry,
  searchMeetingRooms, readMeetingRoomBookings, bookMeetingRoom, cancelMeetingRoom,
};
