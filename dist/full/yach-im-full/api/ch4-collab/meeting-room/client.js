/**
 * 会议室预约客户端（huiyi.tal.com）
 *
 * ⭐ 破解要点（推翻此前"主 capi 做不了"的结论）：会议室预约**不用浏览器**，
 *   走一条纯 HTTP 的好未来统一登录链：
 *     1. POST 94capi/ucenter/auth/code           → 拿一次性 authCode（复用现有签名）
 *     2. controller.100tal.com:8443/idp/app/login → 拼 _authCode，手动跟 302
 *     3. sso.100tal.com/portal/login/978353613    → 一路跳到 huiyi.tal.com/auth-meeting-login?token=***
 *     4. GET huiyi.tal.com/prod-api/mobile/auth_login?token=***&corpid=... → 拿 sessionid cookie
 *   之后所有会议室业务接口都在 huiyi.tal.com/prod-api/meeting/*，带 sessionid cookie 即可。
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 meeting-room/client.js，改写为 CJS。
 */
'use strict';

const { requestAuthCode } = require('../../../auth/web-sso');
const {
  mergeCookies,
  extractCookiesFromResponse,
  createBrowserHeaders,
  followBrowserRedirects,
  buildCookieHeader,
  fetchWithTimeout,
} = require('../../../utils/web-request');

const CONTROLLER_APP_LOGIN_URL =
  'https://controller.100tal.com:8443/idp/app/login?app_id=app_ipg9oj6pxbvgkzglmuez-l7pop&ins_id=spa_d0e97e32-909d-4162-a68f-58609950a74d&access_type=app&redirect_url=https%3A%2F%2Fhuiyi.tal.com%2Fbooking%2Fbooking%3Fto%3Dbooking%252Fbooking';
const MEETING_PORTAL_LOGIN_URL = 'https://sso.100tal.com/portal/login/978353613';
const MEETING_AUTH_LOGIN_URL = 'https://huiyi.tal.com/prod-api/mobile/auth_login';
const MEETING_API_ORIGIN = 'https://huiyi.tal.com';
const MEETING_BOOKING_URL = 'https://huiyi.tal.com/booking/booking?to=booking%2Fbooking';

function ensureRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function readErrorMessage(payload) {
  const r = ensureRecord(payload);
  return String(r.message || r.msg || '').trim();
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}

// ── 归一化 ──────────────────────────────────────────────────

function normalizeScope(v) {
  return {
    cityId: String(v.city_id ?? v.cityId ?? ''),
    cityName: String(v.city_name ?? v.cityName ?? ''),
    officeId: String(v.office_id ?? v.officeId ?? ''),
    officeName: String(v.office_name ?? v.officeName ?? ''),
  };
}

function normalizeRoomItem(raw, scope) {
  const resources = [
    ...asArray(raw.resources)
      .map((i) => ensureRecord(i))
      .map((i) => String(i.name || '').trim())
      .filter(Boolean),
    ...String(raw.resource_names || '')
      .split(',')
      .map((i) => i.trim())
      .filter(Boolean),
  ];
  const uniqueResources = Array.from(new Set(resources));
  const capacity = Number(raw.capacity);
  const maxSingle = Number(raw.maxSingle || raw.single_time);
  return {
    id: String(raw.id || ''),
    guid: String(raw.guid || ''),
    name: String(raw.name || ''),
    cityName: String(raw.cityname || raw.city_name || scope.cityName || ''),
    officeName: String(raw.officename || raw.office_name || scope.officeName || ''),
    floorName: String(raw.floorname || raw.floor_name || ''),
    roomType: String(raw.typename || ''),
    capacity: Number.isFinite(capacity) ? capacity : null,
    setupMinutes: Number(raw.setup || 0) || 0,
    dismantleMinutes: Number(raw.dismantle || 0) || 0,
    openTime: String(raw.open || raw.opentime || ''),
    closeTime: String(raw.close || raw.closetime || ''),
    maxSingleHours: Number.isFinite(maxSingle) && maxSingle > 0 ? maxSingle : null,
    readonly: Number(raw.readonly || 0) === 1,
    locked: Number(raw.islock || 0) === 1,
    resources: uniqueResources,
    scope,
    bookings: [],
  };
}

function normalizeMeetingItem(raw) {
  const startTime = String(raw.start_time || raw.show_start_time || '');
  const endTime = String(raw.end_time || raw.show_end_time || '');
  return {
    id: String(raw.id || ''),
    title: String(raw.title || ''),
    start: startTime.length >= 16 ? startTime.slice(11, 16) : '',
    end: endTime.length >= 16 ? endTime.slice(11, 16) : '',
    startTime,
    endTime,
    mine: Number(raw.myself || 0) === 1,
    auditState: String(raw.audit_state || ''),
  };
}

function roomIdentity(room) {
  return room.id || room.guid || room.name;
}

function queryValue(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}
function encodeQuery(params) {
  const pairs = [];
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== null && item !== undefined && item !== '') pairs.push([`${key}[]`, queryValue(item)]);
      });
      return;
    }
    if (value === null || value === undefined) return;
    pairs.push([key, queryValue(value)]);
  });
  return new URLSearchParams(pairs).toString();
}

// ── SSO 换登（会议室专用链）─────────────────────────────────

/**
 * 用当前知音楼登录态换取会议室（huiyi.tal.com）的 cookie 会话。
 * @param {object} profile { workcode, department, username, avatarUrl }
 * @returns {Promise<object>} 会议室 session（含 sessionId/userId/cookies 等）
 */
async function bootstrapMeetingRoomSession(profile = {}) {
  const authCode = await requestAuthCode();

  const initialUrl = new URL(CONTROLLER_APP_LOGIN_URL);
  const initialResponse = await fetchWithTimeout(initialUrl, {
    method: 'GET',
    headers: createBrowserHeaders(initialUrl, []),
    redirect: 'manual',
  });
  let cookies = mergeCookies([], extractCookiesFromResponse(initialResponse, initialUrl));
  const initialLocation = initialResponse.headers.get('location');
  if (!(initialResponse.status >= 300 && initialResponse.status < 400) || !initialLocation) {
    throw new Error('会议室 SSO 初始跳转没有返回登录 location。');
  }

  const authEntryUrl = new URL(initialLocation, initialUrl);
  authEntryUrl.searchParams.set('_authCode', authCode);
  const sso = await followBrowserRedirects({ url: authEntryUrl.toString(), cookies });
  cookies = sso.cookies;

  const portal = await followBrowserRedirects({
    url: MEETING_PORTAL_LOGIN_URL,
    cookies,
    stopOn: (url) => url.hostname === 'huiyi.tal.com' && url.pathname === '/auth-meeting-login',
  });
  cookies = portal.cookies;

  const authMeetingUrl = new URL(portal.finalUrl);
  const token = authMeetingUrl.searchParams.get('token') || '';
  const corpid = authMeetingUrl.searchParams.get('corpid') || '978353613';
  const agentid = authMeetingUrl.searchParams.get('agentid') || corpid;
  const type = authMeetingUrl.searchParams.get('type') || 'YachSSO';
  const company = authMeetingUrl.searchParams.get('company') || '1';
  if (!token) throw new Error('会议室 SSO 没有返回 app token。');

  const authLoginUrl = new URL(MEETING_AUTH_LOGIN_URL);
  authLoginUrl.searchParams.set('corpid', corpid);
  authLoginUrl.searchParams.set('agentid', agentid);
  authLoginUrl.searchParams.set('type', type);
  authLoginUrl.searchParams.set('company', company);
  authLoginUrl.searchParams.set('token', token);
  authLoginUrl.searchParams.set('timeZone', 'UTC+08:00');
  authLoginUrl.searchParams.set('cropid', corpid);

  const authHeaders = createBrowserHeaders(authLoginUrl, cookies);
  authHeaders.Accept = 'application/json, text/plain, */*';
  authHeaders.Referer = MEETING_BOOKING_URL;
  const authResponse = await fetchWithTimeout(authLoginUrl, { method: 'GET', headers: authHeaders });
  cookies = mergeCookies(cookies, extractCookiesFromResponse(authResponse, authLoginUrl));
  const authText = await authResponse.text();
  let authPayload = {};
  try {
    authPayload = ensureRecord(JSON.parse(authText));
  } catch {
    throw new Error(`会议室 auth_login 返回了非 JSON 响应：HTTP ${authResponse.status}`);
  }
  if (Number(authPayload.code ?? -1) !== 0) {
    throw new Error(
      `会议室 auth_login 失败（code=${authPayload.code ?? 'unknown'}）：${readErrorMessage(authPayload) || '未返回可读错误信息。'}`,
    );
  }
  const authData = ensureRecord(authPayload.data);
  const userInfo = ensureRecord(authData.userinfo);
  const userId = String(userInfo.user_id || '').trim();
  const userName = String(userInfo.name || profile.userName || '').trim();
  const sessionId = cookies.find((c) => c.name === 'sessionid')?.value || '';
  if (!userId || !sessionId) {
    const names = Array.from(new Set(cookies.map((c) => c.name))).join(',');
    throw new Error(`会议室 SSO 已完成，但没有解析到 sessionid 或 userinfo（userId=${userId || '-'} cookies=${names || '-'}）。`);
  }
  return {
    finalUrl: MEETING_BOOKING_URL,
    sessionId,
    userId,
    userName,
    workcode: String(profile.workcode || '').trim(),
    department: String(profile.department || '').trim(),
    username: String(profile.username || profile.workcode || '').trim(),
    avatarUrl: String(profile.avatarUrl || '').trim(),
    cookies,
    updatedAt: Date.now(),
  };
}

// ── 业务 API 客户端 ─────────────────────────────────────────

function createMeetingRoomApiClient(session) {
  let cookies = session.cookies;

  async function requestJson(options) {
    const queryString = options.query ? encodeQuery(options.query) : '';
    const basePath = options.path.startsWith('/') ? options.path : `/${options.path}`;
    const url = new URL(queryString ? `${basePath}?${queryString}` : basePath, MEETING_API_ORIGIN);
    const headers = {
      Accept: 'application/json, text/plain, */*',
      Referer: session.finalUrl || MEETING_BOOKING_URL,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) yach-agent',
    };
    const cookieHeader = buildCookieHeader(cookies, url);
    if (cookieHeader) headers.Cookie = cookieHeader;
    let body;
    if (options.method === 'POST') {
      headers['Content-Type'] = 'application/json;charset=UTF-8';
      body = JSON.stringify(options.body ?? {});
    }
    const response = await fetchWithTimeout(url, { method: options.method, headers, body });
    cookies = mergeCookies(cookies, extractCookiesFromResponse(response, url));
    if (!response.ok) throw new Error(`会议室接口 ${options.path} 请求失败：HTTP ${response.status}`);
    const payload = ensureRecord(await response.json());
    const code = payload.code;
    if (!(code === 0 || code === '0' || code === undefined || code === null)) {
      throw new Error(readErrorMessage(payload) || `会议室接口失败：${options.path}`);
    }
    return payload;
  }

  return {
    get cookies() {
      return cookies;
    },

    async listOfficeTree() {
      const payload = await requestJson({
        method: 'GET',
        path: '/prod-api/meeting/city_office_all',
        query: { is_all: 1 },
      });
      const cities = asArray(payload.data);
      return cities.flatMap((city) => {
        const c = ensureRecord(city);
        const cityId = String(c.id || '').trim();
        const cityName = String(c.name || '').trim();
        return asArray(c.children)
          .map((office) => ({
            city_id: cityId,
            city_name: cityName,
            office_id: String(office.id || '').trim(),
            office_name: String(office.name || '').trim(),
          }))
          .filter((s) => s.city_id && s.office_id)
          .map((s) => normalizeScope(s));
      });
    },

    async listRoomsPage(request) {
      const payload = await requestJson({
        method: 'GET',
        path: '/prod-api/meeting/meetingroom_meeting_page',
        query: {
          date: request.date,
          title: request.keyword || '',
          page: request.page ?? 1,
          limit: request.limit ?? 100,
          sort: '-order_no',
          floor: [],
          floor_name: '',
          roomresource: [],
          capacity: '',
          start_time: request.start || '',
          end_time: request.end || '',
          free: request.free === true,
          cityOfficeFloor: [],
          city: request.scope.cityId,
          office: request.scope.officeId,
          city_name: request.scope.cityName,
          office_name: request.scope.officeName,
          city_office: [request.scope.cityId, request.scope.officeId],
        },
      });
      const data = ensureRecord(payload.data);
      const items = asArray(data.items);
      return {
        total: Number(data.total) || items.length,
        rooms: items.map((i) => normalizeRoomItem(ensureRecord(i), request.scope)).filter((r) => r.id && r.name),
      };
    },

    async listManyRoomMeetings(roomIds, date) {
      if (roomIds.length === 0) return {};
      const payload = await requestJson({
        method: 'GET',
        path: '/prod-api/meeting/many_room_meeting',
        query: { ids: roomIds.join(','), date },
      });
      const data = ensureRecord(payload.data);
      return roomIds.reduce((acc, roomId) => {
        const roomData = ensureRecord(data[roomId]);
        acc[roomId] = asArray(roomData.meeting)
          .map((i) => normalizeMeetingItem(ensureRecord(i)))
          .filter((m) => m.id);
        return acc;
      }, {});
    },

    async getMeetingDetails(meetingId) {
      const payload = await requestJson({ method: 'GET', path: '/prod-api/meeting/details', query: { id: meetingId } });
      return ensureRecord(payload.data);
    },

    async createMeeting(payload) {
      const response = await requestJson({ method: 'POST', path: '/prod-api/meeting/add', body: payload });
      const data = ensureRecord(response.data);
      const meetingId = String(data.id || '').trim();
      if (!meetingId) throw new Error('会议室预订成功，但接口没有返回 meeting id。');
      return meetingId;
    },

    async deleteMeeting(meetingId) {
      await requestJson({ method: 'POST', path: '/prod-api/meeting/del', body: { id: Number(meetingId) } });
    },
  };
}

module.exports = {
  bootstrapMeetingRoomSession,
  createMeetingRoomApiClient,
  roomIdentity,
  MEETING_API_ORIGIN,
  MEETING_BOOKING_URL,
};
