/**
 * 知音楼 HTTP 请求基础封装
 * 自动注入公共 Headers + 签名
 */
const https = require('https');
const http = require('http');
const querystring = require('querystring');
const { getSign } = require('./sign');
const { loadSession } = require('../auth/session');

// ⭐ 设备指纹常量（对齐抓包文档 2026-07-14 的真实公共 header）
//   知音楼服务端不强校验设备型号，但要求 client-ver / os / yach-version-area 等
//   header 存在且格式合理。这里统一伪装成一台桌面客户端，全局一致，避免各接口发飘。
//   —— 参考抓包真实值：client-ver=2.0.1.1, os=ipados, os-ver=26.5, device-name=iPad8,6
//      本 Agent 是桌面/服务端形态，故 os 用 mac、client-ver 对齐桌面端 2.0.0.5。
const DEVICE_PROFILE = {
  clientVer:   '2.0.0.5',            // 桌面端版本（与逆向源码一致）
  os:          'mac',               // 抓包是 ipados；本 Agent 桌面形态用 mac
  osVer:       '15.0',              // 系统版本（数字串）
  deviceName:  'yach-agent-desktop',// 设备型号标识
  versionArea: 'YachAreaRed',       // 版本区域（抓包固定值）
  userAgent:   'Yach-Mac/2.0.5 (Macintosh; macOS 15.0; Scale/2.00)', // 对齐抓包 UA 格式
  timezone:    'Asia/Shanghai',
};

// 已验证可用的路由前缀 → base URL 映射
// 所有路由前缀均指向同一 capi 网关，由网关内部分发
const CAPI_BASE = 'https://yach-capi.zhiyinlou.com';
const STREAM_BASE = 'https://yach-stream.zhiyinlou.com'; // 619_api（AI 机器人 prompt / 流式消息）走独立 stream 域名
const PREFIX_MAP = {
  '94capi':      CAPI_BASE,  // 主 capi: 群组、组织、消息、机器人等
  '913scd':      CAPI_BASE,  // 日程
  '25doc':       CAPI_BASE,  // 文档/知识库
  '95search':    CAPI_BASE,  // 全局搜索
  'bsvr':        CAPI_BASE,  // 通知/remind/workstate
  'usergroup':   CAPI_BASE,  // 用户组/群公告
  '609usergroup':CAPI_BASE,  // 初始化数据
  '93oapi':      CAPI_BASE,  // 外部 OpenAPI 网关
  '93client':     CAPI_BASE,  // 自定义 AI 机器人管理（airobot/add/edit/del）
  'y':            CAPI_BASE,  // 未来人社区（young）
  '636_ai':      CAPI_BASE,  // AI 接口
  '619_api':     STREAM_BASE, // ⭐ airobot prompt：走 stream 域名（2026-07-21 验证）
  '682api':      CAPI_BASE,
  '682':         CAPI_BASE,  // 682/client/api/collection/*
  '694api':      CAPI_BASE,
  '615api':      CAPI_BASE,
  '615bsvr':     CAPI_BASE,  // 浮窗/用户设置/消息绑定
  'com694':      CAPI_BASE,  // 考勤/安全/服务区域
  '925multi':    CAPI_BASE,  // 多端登录通知
  'zb':          CAPI_BASE,  // 直播 (zb/capi/lives*)
  '696file':     CAPI_BASE,  // 文件通知/回收站
  'mgo':         CAPI_BASE,  // 周报 (mgo/log/*)
  'mfilter':     CAPI_BASE,  // 消息敏感词过滤
  '96file':      CAPI_BASE,  // 文件预览
  'link':        CAPI_BASE,  // 会议/音视频信令（home.js: t="link"）
  '612meeting':  CAPI_BASE,  // 会议、速记和 AI 图像
};

/**
 * POST application/x-www-form-urlencoded
 * @param {string} path  e.g. "94capi/robot/message/send"
 * @param {Object} body  业务参数（不含签名）
 */
async function post(path, body = {}) {
  const session = loadSession();
  const { sign, timestamp } = getSign(body);

  const formData = querystring.stringify(body);
  const url = resolveUrl(path);

  const headers = buildHeaders(session, sign, timestamp, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData),
  });

  return request('POST', url + `?sign=${sign}&timestamp=${timestamp}`, headers, formData);
}

/**
 * POST 公共接口，不读取或注入本地登录 session。
 *
 * 登录二维码初始化接口明确无需登录态。与普通 post() 分开，避免已注销的旧
 * Authorization/accesstoken 被自动带入请求，导致服务端在生成 randstr 前返回 401。
 */
async function postPublic(path, body = {}) {
  const { sign, timestamp } = getSign(body);

  const formData = querystring.stringify(body);
  const url = resolveUrl(path);
  const headers = buildPublicHeaders(sign, timestamp, {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(formData),
  });

  return request('POST', url + `?sign=${sign}&timestamp=${timestamp}`, headers, formData);
}

/**
 * POST application/json（对齐桌面端 jsonRequest）
 * ⭐ 617lorebase 前缀的知识库空间节点接口必须用这个（真调验证 2026-07-20）：
 *   form-urlencoded 会把 body（尤其数组字段如 node_id:[...]）搞坏，
 *   服务端解析不出 topic_id → 报 61000101（TOPIC_NON_EXIST，被 UI 显成“知识库已删除”）。
 *   用 JSON body 则真调返回 200。
 * @param {string} path  e.g. "617lorebase/space/sidenodes"
 * @param {Object} body  业务参数（不含签名）
 */
async function postJson(path, body = {}) {
  const session = loadSession();
  const { sign, timestamp } = getSign(body);

  const data = JSON.stringify(body);
  const url = resolveUrl(path);

  const headers = buildHeaders(session, sign, timestamp, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  });

  return request('POST', url + `?sign=${sign}&timestamp=${timestamp}`, headers, data);
}

/**
 * GET 请求（签名放 query params）
 * @param {string} path
 * @param {Object} params
 */
async function get(path, params = {}) {
  const session = loadSession();
  const { sign, timestamp } = getSign(params);
  const qs = querystring.stringify({ ...params, sign, timestamp });
  const url = resolveUrl(path) + '?' + qs;
  const headers = buildHeaders(session, sign, timestamp, {});
  return request('GET', url, headers, null);
}

/**
 * GET 公共接口，不读取或注入本地登录 session。
 *
 * 二维码状态轮询在登录完成前也不应依赖旧 session；否则失效的旧 token 会让
 * 等待扫码的请求直接返回 401，遮蔽真正的二维码状态。
 */
async function getPublic(path, params = {}) {
  const { sign, timestamp } = getSign(params);
  const qs = querystring.stringify({ ...params, sign, timestamp });
  const url = resolveUrl(path) + '?' + qs;
  const headers = buildPublicHeaders(sign, timestamp, {});
  return request('GET', url, headers, null);
}

// ── internals ──────────────────────────────────────────────

function resolveUrl(path) {
  const prefix = path.split('/')[0];
  const base = PREFIX_MAP[prefix] || 'https://yach-capi.zhiyinlou.com';
  return base + '/' + path;
}

// device-id 由 workcode 派生，稳定不变（同一账号每次一致），格式对齐抓包 TAL... 前缀
function deriveDeviceId(workcode) {
  const crypto = require('crypto');
  const h = crypto.createHash('md5').update(`yach-agent-${workcode || 'anon'}`).digest('hex').toUpperCase();
  return 'TAL' + h; // 例：TAL + 32位大写hex，形似真实 device-id
}

// traceid：32 位大写 hex（对齐抓包格式）
function genTraceId() {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex').toUpperCase();
}

// gtoken：AES-128-ECB encrypt(workcode + '_' + cp_id, key=SDJ0U#$2io9F&#*J) → base64
function genGtoken(workcode, cpId) {
  const { createCipheriv } = require('crypto');
  const gKey = 'SDJ0U#$2io9F&#*J';
  const raw = `${workcode}_${cpId || 1}`;
  const cipher = createCipheriv('aes-128-ecb', Buffer.from(gKey), null);
  return Buffer.concat([cipher.update(raw), cipher.final()]).toString('base64');
}

function buildHeaders(session, sign, timestamp, extra = {}) {
  const workcode = session.workcode || '';
  const cpId     = session.cp_id || 1;
  const uid      = session.uid || (session.user && session.user.id) || '';
  const gtoken   = genGtoken(workcode, cpId);

  const headers = {
    // ── 身份凭证 ──
    'Authorization': session.token || '',
    'uid':           String(uid),                 // ⭐ 抓包每个接口都带
    'workcode':      String(workcode),
    'deptid':        String(session.deptid || ''),
    'gtoken':        gtoken,
    // ── 签名 ──
    'sign':          sign,
    'timestamp':     String(timestamp),
    // ── 设备指纹（全局一致）──
    'device-id':     deriveDeviceId(workcode),
    'device-name':   DEVICE_PROFILE.deviceName,
    'os':            DEVICE_PROFILE.os,
    'os-ver':        DEVICE_PROFILE.osVer,          // ⭐ 抓包带，之前缺
    'system-ver':    DEVICE_PROFILE.osVer,          // 与 os-ver 一致（抓包同值）
    'client-ver':    DEVICE_PROFILE.clientVer,       // ⭐ 对齐 2.0.0.5，之前是 0.5.0
    'yach-version-area': DEVICE_PROFILE.versionArea, // ⭐ 抓包带，之前缺
    'timezone':      DEVICE_PROFILE.timezone,
    // ⭐ User-Agent：服务端 organ 等接口读 HTTP_USER_AGENT，缺失报 8。
    //   对齐抓包真实格式 Yach-<Plat>/<ver> (...)，而非之前的 native Mozilla 乱值。
    'User-Agent':    DEVICE_PROFILE.userAgent,
    'traceid':       genTraceId(),
    // ── 语言/内容 ──
    'HTTP_CONTENT_LANGUAGE': 'zh-CN',
    'Content-Type':  'application/json',
  };

  // accesstoken 是与 Authorization 并列的独立字段（抓包实证两者都带）；
  // 老 session 可能没存，缺失时不发（保持向后兼容）。
  if (session.accesstoken) headers['accesstoken'] = session.accesstoken;

  return { ...headers, ...extra };
}

function buildPublicHeaders(sign, timestamp, extra = {}) {
  const headers = buildHeaders({}, sign, timestamp, extra);
  for (const key of ['Authorization', 'accesstoken', 'uid', 'workcode', 'deptid', 'gtoken']) {
    delete headers[key];
  }
  return headers;
}

function request(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
    };
    let settled = false;
    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const req = lib.request(options, res => {
      const chunks = [];
      let size = 0;
      const maxResponseBytes = 10 * 1024 * 1024;
      res.on('data', c => {
        size += c.length;
        if (size > maxResponseBytes) {
          res.destroy(new Error(`响应超过 ${maxResponseBytes} bytes`));
          return;
        }
        chunks.push(c);
      });
      res.on('error', finishReject);
      res.on('end', () => {
        if (settled) return;
        const data = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          if (res.statusCode === 401 || /ERR[_ ]TOKEN|token[^a-z]*(?:expired|invalid|失效)/i.test(data)) {
            return finishReject(new Error('知音楼 HTTP 登录态已失效，请执行 /yach_login 重新登录；NIM 长连接可独立继续使用'));
          }
          return finishReject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        }
        try {
          const parsed = data ? JSON.parse(data) : {};
          const apiCode = Number(parsed?.code);
          const apiMessage = String(parsed?.msg ?? parsed?.message ?? '');
          if (apiCode === 401 || /ERR[_ ]TOKEN|token[^a-z]*(?:expired|invalid|失效)/i.test(apiMessage)) {
            return finishReject(new Error('知音楼 HTTP 登录态已失效，请执行 /yach_login 重新登录；NIM 长连接可独立继续使用'));
          }
          settled = true;
          resolve(parsed);
        } catch {
          settled = true;
          resolve(data);
        }
      });
    });
    req.setTimeout(20_000, () => req.destroy(new Error('HTTP 请求超时')));
    req.on('error', finishReject);
    if (body) req.write(body);
    req.end();
  });
}

// buildHeaders 导出供调试/自检（验证公共 header 是否对齐抓包）
module.exports = {
  get,
  getPublic,
  post,
  postPublic,
  postJson,
  buildHeaders,
  buildPublicHeaders,
  DEVICE_PROFILE,
};
