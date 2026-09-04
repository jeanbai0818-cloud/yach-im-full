/**
 * 会议室业务编排：搜房 / 查占用 / 订房 / 取消
 *
 * 自动管理会议室 cookie 会话（失效自动重新 SSO 换登）。
 * profile（workcode/department/username/avatar）从当前知音楼 session 提取。
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 meeting-room/service.js，改写为 CJS，
 * 去除对 contact-directory 快照的依赖（直接用 session.user + workcode）。
 */
'use strict';

const { loadSession } = require('../../../auth/session');
const {
  bootstrapMeetingRoomSession,
  createMeetingRoomApiClient,
  roomIdentity,
} = require('./client');
const {
  readStoredMeetingRoomSession,
  writeStoredMeetingRoomSession,
} = require('./store');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_ROOM_PREVIEW = 8;
const ROOM_PAGE_LIMIT = 100;

function ensureRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function readString(v) {
  return String(v || '').trim();
}
function normalizeText(v) {
  return String(v || '').trim().replace(/\s+/g, '').toLowerCase();
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseDate(v) {
  const n = readString(v);
  if (!DATE_PATTERN.test(n)) throw new Error(`日期格式必须是 YYYY-MM-DD：${n}`);
  return n;
}
function parseTime(v, field) {
  const n = readString(v);
  if (!TIME_PATTERN.test(n)) throw new Error(`${field} 必须是 HH:MM：${n}`);
  return n;
}
function parseTimeRange(start, end) {
  const s = parseTime(start, '开始时间');
  const e = parseTime(end, '结束时间');
  if (e <= s) throw new Error(`结束时间必须晚于开始时间：${s}-${e}`);
  return { start: s, end: e };
}
function parseClockMinutes(v) {
  const n = readString(v);
  if (!n) return null;
  if (n === '24:00') return 24 * 60;
  if (!TIME_PATTERN.test(n)) return null;
  const [h = '0', m = '0'] = n.split(':');
  return Number(h) * 60 + Number(m);
}

function describeRoom(room) {
  const scope = `${room.scope.cityName || '-'} / ${room.scope.officeName || '-'} / ${room.floorName || '-'}`;
  return `${room.name} (${scope}, id=${room.id})`;
}
function bookingLabel(room) {
  return `${room.scope.cityName || '-'} / ${room.scope.officeName || '-'} / ${room.name}`;
}

function matchFields(room) {
  return [room.id, room.guid, room.name, room.scope.officeName, room.scope.cityName, room.floorName].map(normalizeText);
}
function exactRoomMatches(rooms, query) {
  const needle = normalizeText(query);
  return rooms.filter((room) => matchFields(room).some((c) => c === needle));
}
function fuzzyRoomMatches(rooms, query) {
  const needle = normalizeText(query);
  return rooms.filter((room) => matchFields(room).some((c) => c.includes(needle)));
}
function pickSingleRoom(rooms, query) {
  const exact = exactRoomMatches(rooms, query);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) {
    throw new Error(`匹配到多个会议室，请改用更精确的名字或 id：${exact.slice(0, MAX_ROOM_PREVIEW).map(describeRoom).join('；')}`);
  }
  const fuzzy = fuzzyRoomMatches(rooms, query);
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) {
    throw new Error(`匹配到多个会议室，请改用更精确的名字或 id：${fuzzy.slice(0, MAX_ROOM_PREVIEW).map(describeRoom).join('；')}`);
  }
  throw new Error(`找不到会议室：${query}`);
}

// ── scope（城市/办公区）选择 ────────────────────────────────

function cityCandidates(scope) {
  return [scope.cityId, scope.cityName].map(normalizeText);
}
function officeCandidates(scope) {
  return [scope.officeId, scope.officeName].map(normalizeText);
}
function selectScope(scopes, office, city = '') {
  if (!office) throw new Error('office 不能为空。');
  let candidates = scopes;
  const nCity = normalizeText(city);
  if (nCity) {
    const exactCity = candidates.filter((s) => cityCandidates(s).some((c) => c === nCity));
    if (exactCity.length > 0) candidates = exactCity;
    else {
      const fuzzyCity = candidates.filter((s) => normalizeText(s.cityName).includes(nCity));
      if (fuzzyCity.length > 0) candidates = fuzzyCity;
      else throw new Error(`找不到城市：${city}`);
    }
  }
  const nOffice = normalizeText(office);
  const exactOffice = candidates.filter((s) => officeCandidates(s).some((c) => c === nOffice));
  if (exactOffice.length === 1) return exactOffice[0];
  if (exactOffice.length > 1) {
    throw new Error(`命中多个办公区，请补 city：${exactOffice.slice(0, MAX_ROOM_PREVIEW).map((s) => `${s.cityName}/${s.officeName}`).join('；')}`);
  }
  const fuzzyOffice = candidates.filter((s) => normalizeText(s.officeName).includes(nOffice));
  if (fuzzyOffice.length === 1) return fuzzyOffice[0];
  if (fuzzyOffice.length > 1) {
    throw new Error(`命中多个办公区，请改用更精确名字：${fuzzyOffice.slice(0, MAX_ROOM_PREVIEW).map((s) => `${s.cityName}/${s.officeName}`).join('；')}`);
  }
  throw new Error(`找不到办公区：${office}`);
}

// ── 可订性校验 ──────────────────────────────────────────────

function roomBookingIssues(room, start, end) {
  const startMin = parseClockMinutes(start);
  const endMin = parseClockMinutes(end);
  if (startMin === null || endMin === null) return [];
  const issues = [];
  if (room.readonly) issues.push('房间当前为只读状态。');
  if (room.locked) issues.push('房间当前已锁定。');
  const openMin = parseClockMinutes(room.openTime);
  const closeMin = parseClockMinutes(room.closeTime);
  if (openMin !== null && startMin < openMin) issues.push(`开始时间早于开放时间 ${room.openTime}。`);
  if (closeMin !== null && endMin > closeMin) issues.push(`结束时间晚于关闭时间 ${room.closeTime}。`);
  if (room.maxSingleHours !== null && room.maxSingleHours > 0) {
    if (endMin - startMin > room.maxSingleHours * 60) issues.push(`超过单次最长 ${room.maxSingleHours} 小时限制。`);
  }
  const conflicts = room.bookings
    .filter((b) => {
      const bs = parseClockMinutes(b.start);
      const be = parseClockMinutes(b.end);
      if (bs === null || be === null) return false;
      return startMin < be && endMin > bs;
    })
    .sort((a, b) => a.start.localeCompare(b.start, 'zh-CN'));
  if (conflicts.length > 0) {
    issues.push(`目标时段已有占用：${conflicts.slice(0, 3).map((b) => `${b.start}-${b.end} ${b.title || '已预订'}`).join('；')}`);
  }
  return issues;
}

// ── session 生命周期 ────────────────────────────────────────

function resolveProfile() {
  const s = loadSession();
  return {
    workcode: readString(s.workcode),
    department: '',
    username: readString(s.workcode),
    userName: readString(s.user && (s.user.name || s.user.realname)),
    avatarUrl: readString(s.user && (s.user.avatarUrl || s.user.avatar)),
  };
}

function parseWorkstation(workstation) {
  const value = readString(workstation).toUpperCase();
  if (!value) return { workstation: '', floor: '', area: '' };
  const segment = value.split('-').find((part) => /^\d+[A-Z]$/.test(part))
    || (value.match(/(?:^|-)(\d+)([A-Z])(?:-|$)/)?.[0] || '').replace(/-/g, '');
  const match = /^(\d+)([A-Z])$/.exec(segment);
  return {
    workstation: value,
    floor: match ? match[1] : '',
    area: match ? match[2] : '',
  };
}

function roomLocationScore(room, hint) {
  if (!hint.floor && !hint.area) return 0;
  const text = `${readString(room.floorName)} ${readString(room.name)}`.toUpperCase();
  const floorMatch = hint.floor
    ? new RegExp(`(^|\\D)${hint.floor}(?:层|F|楼|\\D|$)`, 'i').test(text)
    : false;
  const areaMatch = hint.area
    ? new RegExp(`(^|[^A-Z])${hint.area}(?:区|AREA|[^A-Z]|$)`, 'i').test(text)
    : false;
  return (floorMatch ? 100 : 0) + (areaMatch ? 20 : 0);
}

function rankRoomsByWorkstation(rooms, workstation, floor, area) {
  const parsed = parseWorkstation(workstation);
  const hint = {
    workstation: parsed.workstation,
    floor: readString(floor) || parsed.floor,
    area: readString(area).toUpperCase() || parsed.area,
  };
  const ranked = rooms.map((room, index) => ({
    room,
    index,
    score: roomLocationScore(room, hint),
  })).sort((a, b) => b.score - a.score || a.index - b.index);
  return {
    hint,
    sameFloorCount: ranked.filter((item) => item.score >= 100).length,
    sameAreaCount: ranked.filter((item) => item.score >= 120).length,
    rooms: ranked.map((item) => item.room),
  };
}

async function ensureMeetingRoomSession(output) {
  const existing = readStoredMeetingRoomSession();
  if (existing) {
    const client = createMeetingRoomApiClient(existing);
    try {
      await client.listOfficeTree();
      return existing;
    } catch {
      output && output('meeting-room: 现有会议室会话疑似失效，正在重新换取 SSO...');
    }
  }
  output && output('meeting-room: 正在通过登录态换取会议室 SSO...');
  const profile = resolveProfile();
  const session = await bootstrapMeetingRoomSession(profile);
  writeStoredMeetingRoomSession(session);
  return session;
}

async function createClient(output) {
  const session = await ensureMeetingRoomSession(output);
  return { session, client: createMeetingRoomApiClient(session) };
}

// ── 搜房（含占用）核心 ──────────────────────────────────────

async function searchRoomsInternal(params) {
  const allScopes = await params.client.listOfficeTree();
  const scopes = params.office ? [selectScope(allScopes, params.office, params.city)] : allScopes;

  async function fetchScopeRooms(scope) {
    const rooms = [];
    for (let page = 1; page <= 20; page += 1) {
      // ⚠️ 只按 date/keyword/scope 拉全量房间；free/start/end 的空闲过滤在本地用
      //   roomBookingIssues 做（接口带 start_time/end_time 会直接报「出错了」）。
      const pageResult = await params.client.listRoomsPage({
        date: params.date,
        keyword: params.keyword,
        scope,
        page,
        limit: ROOM_PAGE_LIMIT,
      });
      rooms.push(...pageResult.rooms);
      if (pageResult.rooms.length < ROOM_PAGE_LIMIT) break;
    }
    return rooms;
  }

  const scopeResults = await Promise.all(scopes.map((s) => fetchScopeRooms(s)));
  const bucket = new Map();
  for (const rooms of scopeResults) for (const room of rooms) bucket.set(roomIdentity(room), room);

  const rooms = Array.from(bucket.values()).sort(
    (a, b) =>
      a.scope.cityName.localeCompare(b.scope.cityName, 'zh-CN') ||
      a.scope.officeName.localeCompare(b.scope.officeName, 'zh-CN') ||
      a.floorName.localeCompare(b.floorName, 'zh-CN') ||
      a.name.localeCompare(b.name, 'zh-CN'),
  );

  const roomIds = uniqueStrings(rooms.map((r) => r.id));
  const meetingsByRoom = await params.client.listManyRoomMeetings(roomIds, params.date);
  const withBookings = rooms.map((r) => ({ ...r, bookings: meetingsByRoom[r.id] ?? [] }));

  if (params.free && params.start && params.end) {
    return withBookings.filter((r) => roomBookingIssues(r, params.start, params.end).length === 0);
  }
  return withBookings;
}

// ── 预订 payload ────────────────────────────────────────────

function buildMeetingRoomPayload(p) {
  const avatar = p.roomSession.avatarUrl ? { path: p.roomSession.avatarUrl, name: p.roomSession.avatarUrl } : null;
  const attendee = {
    id: p.roomSession.userId,
    user_id: p.roomSession.userId,
    name: p.roomSession.userName,
    job_num: p.roomSession.workcode,
    type: 'user',
  };
  if (avatar) attendee.avatar = avatar;
  const bookPerson = {
    id: p.roomSession.userId,
    name: p.roomSession.userName,
    job_num: p.roomSession.workcode,
    department: p.roomSession.department,
  };
  if (p.roomSession.username) bookPerson.username = p.roomSession.username;
  if (avatar) bookPerson.avatar = avatar;
  const payload = {
    title: p.title,
    start_date: p.date,
    end_date: p.date,
    start_time: `${p.date} ${p.start}:00`,
    end_time: `${p.date} ${p.end}:00`,
    before_minute: p.room.setupMinutes,
    after_minute: p.room.dismantleMinutes,
    all_day: false,
    timezone: 'UTC+08:00',
    iscycle: 0,
    meetingroom: [Number(p.room.id)],
    meeting_service: p.room.guid ? { [p.room.guid]: [] } : {},
    remind_times: '5',
    book_person_id: p.roomSession.userId,
    book_person_name: p.roomSession.userName,
    book_person_job_num: p.roomSession.workcode,
    book_person_department: p.roomSession.department,
    book_source: 1,
    view_permisson: 1,
    remark: readString(p.remark),
    notice: 1,
    attendees: [attendee],
    online_type: 0,
    attendees_max_num: 100,
    comment_label: '',
    book_person: bookPerson,
  };
  if (p.room.guid) payload.meetingroom_guid = [p.room.guid];
  return payload;
}

function summarizeMeetingDetails(details) {
  const title = readString(details.title);
  const startTime = readString(details.start_time || details.start_date_time);
  const endTime = readString(details.end_time || details.end_date_time);
  const cur = ensureRecord(details.current_meetingroom);
  const room = Object.keys(cur).length > 0
    ? {
        id: readString(cur.id),
        name: readString(cur.name),
        scope: { cityId: '', cityName: readString(cur.cityname), officeId: '', officeName: readString(cur.officename) },
        bookings: [],
      }
    : null;
  return {
    title,
    date: startTime.length >= 10 ? startTime.slice(0, 10) : '',
    start: startTime.length >= 16 ? startTime.slice(11, 16) : '',
    end: endTime.length >= 16 ? endTime.slice(11, 16) : '',
    room,
  };
}

// ── 对外 API ────────────────────────────────────────────────

/** 搜索目标日期/时段内**空闲**的会议室 */
async function searchMeetingRooms(params) {
  const date = parseDate(params.date);
  const range = parseTimeRange(params.start, params.end);
  const { client } = await createClient(params.output);
  const rooms = await searchRoomsInternal({
    client,
    date,
    start: range.start,
    end: range.end,
    keyword: readString(params.keyword),
    office: readString(params.office),
    city: readString(params.city),
    free: true,
  });
  const ranked = rankRoomsByWorkstation(
    rooms,
    params.workstation,
    params.floor,
    params.area,
  );
  return {
    date,
    start: range.start,
    end: range.end,
    keyword: readString(params.keyword),
    requestedOffice: readString(params.office),
    requestedCity: readString(params.city),
    locationHint: ranked.hint,
    sameFloorCount: ranked.sameFloorCount,
    sameAreaCount: ranked.sameAreaCount,
    returned: ranked.rooms.length,
    total: rooms.length,
    rooms: ranked.rooms,
  };
}

/** 查某个会议室某天的占用情况 */
async function readMeetingRoomBookings(params) {
  const roomQuery = readString(params.roomQuery);
  if (!roomQuery) throw new Error('会议室查询关键字不能为空。');
  const date = parseDate(params.date);
  const { client } = await createClient(params.output);
  const rooms = await searchRoomsInternal({
    client,
    date,
    keyword: roomQuery,
    office: readString(params.office),
    city: readString(params.city),
    free: false,
  });
  const room = pickSingleRoom(rooms, roomQuery);
  return { date, room, returned: room.bookings.length, bookings: room.bookings };
}

/** 预订会议室（写操作）*/
async function bookMeetingRoom(params) {
  const date = parseDate(params.date);
  const range = parseTimeRange(params.start, params.end);
  const roomQuery = readString(params.roomQuery);
  const title = readString(params.title);
  if (!roomQuery) throw new Error('会议室查询关键字不能为空。');
  if (!title) throw new Error('会议标题不能为空。');
  const { session, client } = await createClient(params.output);
  const rooms = await searchRoomsInternal({
    client,
    date,
    start: range.start,
    end: range.end,
    keyword: roomQuery,
    office: readString(params.office),
    city: readString(params.city),
    free: false,
  });
  const room = pickSingleRoom(rooms, roomQuery);
  const issues = roomBookingIssues(room, range.start, range.end);
  if (issues.length > 0) throw new Error(`会议室当前不可订：${bookingLabel(room)}；${issues.join('；')}`);
  const payload = buildMeetingRoomPayload({
    roomSession: session,
    room,
    title,
    date,
    start: range.start,
    end: range.end,
    remark: params.remark,
  });
  const meetingId = await client.createMeeting(payload);
  const details = await client.getMeetingDetails(meetingId);
  return {
    action: 'book',
    meetingId,
    verified: Boolean(details && Object.keys(details).length > 0),
    message: '会议室已预订。',
    room,
    title,
    date,
    start: range.start,
    end: range.end,
  };
}

/** 取消会议室预订（写操作）*/
async function cancelMeetingRoom(params) {
  const meetingId = readString(params.meetingId);
  if (!meetingId) throw new Error('meetingId 不能为空。');
  const { client } = await createClient(params.output);
  let summary = { title: '', date: '', start: '', end: '', room: null };
  try {
    summary = summarizeMeetingDetails(await client.getMeetingDetails(meetingId));
  } catch {
    /* ignore */
  }
  await client.deleteMeeting(meetingId);
  let verified = false;
  if (summary.room && summary.date) {
    try {
      const rooms = await searchRoomsInternal({
        client,
        date: summary.date,
        keyword: summary.room.name,
        office: summary.room.scope.officeName,
        city: summary.room.scope.cityName,
        free: false,
      });
      const matched = rooms.find((r) => r.id === summary.room.id) ?? rooms.find((r) => r.name === summary.room.name);
      verified = matched ? !matched.bookings.some((b) => b.id === meetingId) : true;
    } catch {
      verified = false;
    }
  }
  return {
    action: 'cancel',
    meetingId,
    verified,
    message: verified ? '会议室预订已取消并完成回读确认。' : '会议室预订已取消，但暂时没有完成回读确认。',
    room: summary.room,
    title: summary.title,
    date: summary.date,
    start: summary.start,
    end: summary.end,
  };
}

module.exports = {
  searchMeetingRooms,
  readMeetingRoomBookings,
  bookMeetingRoom,
  cancelMeetingRoom,
  // 供测试/复用
  roomBookingIssues,
  selectScope,
  parseWorkstation,
  rankRoomsByWorkstation,
};
