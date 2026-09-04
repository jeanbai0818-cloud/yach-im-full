/**
 * 第一章：IM 消息通信
 *
 * 所有消息走 NIM WebSocket（网易云信 SDK），HTTP REST 仅用于文件登记。
 *
 * 已验证能力（2026-07-12）：
 *   sendText          — P2P 文本消息 ✅
 *   sendFile          — P2P 文件消息（NIM NOS 上传 + custom type=5/10）✅ 手机可打开
 *   sendImage         — P2P 图片消息（NIM sendFile + NOS）✅ 手机/PC 可见
 *   sendAudio         — P2P 音频消息（NIM sendFile + NOS）✅
 *   sendVideo         — P2P 视频消息（NIM sendFile + NOS）✅
 *   sendImageWithText — 图文混排（NIM NOS 上传 + custom type=15 Markdown）✅ 单条气泡
 *   sendTeamText      — 群普通文本消息（scene=team，不带 @）✅
 *   sendTeamCard      — 群富文本卡片（scene=team，不带 @）✅
 *   getHistory        — 从 NIM 云端拉取历史消息 ✅
 *   searchMessages    — 从 NIM 云端全文搜索消息（需开通 SDK 能力）
 *
 * 关键设计决策（来自逆向 home.98a203f1.js）：
 *   1. 所有消息必须携带 pushPayload / pushContent / custom，否则手机端关联不到会话
 *   2. 文件消息用 custom type=5（office/pdf）或 type=10（其他），而非 NIM 原生 file
 *   3. 所有上传全部走 NIM NOS，手机端均可识别；COS 已完全弃用
 *   4. 图文混排用 custom type=15 + Markdown，一条气泡包含图片和文字
 */
const fs = require('fs');
const path = require('path');
const { getNim, withBrowserGlobalsAsync } = require('../../nim/client');
const { loadSession } = require('../../auth/session');
const { post, get } = require('../../utils/request');
const { resolveSafeFile } = require('../../utils/safe-file');
// 上传策略：主力走 NIM NOS（快，无需 STS）；若 NOS 不可用，回退到 cos-upload.js（腾讯云 COS）
// const { uploadToCos } = require('../../utils/cos-upload'); // NOS 备用方案

const YACH_VERSION = '2.0.0.5';
const SEND_TIMEOUT_MS = 15_000;

function normalizeScene(scene = 'p2p') {
  const value = String(scene || 'p2p').trim().toLowerCase();
  if (value !== 'p2p' && value !== 'team') {
    throw new Error('scene 只能是 p2p 或 team');
  }
  return value;
}

function withTimeout(promise, operation) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${operation} timeout after ${SEND_TIMEOUT_MS}ms`)),
      SEND_TIMEOUT_MS,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sentResult(msg, extra = {}) {
  return {
    idServer: msg.idServer,
    idClient: msg.idClient,
    time: msg.time,
    to: msg.to,
    from: msg.from,
    scene: msg.scene,
    ...extra,
    _raw: msg,
  };
}

// 知音楼文件消息 custom type（来源：home.98a203f1.js CUSTOM_ONLINE_PREVIEW_*）
// type=5  office/pdf 文件（在线预览）
// type=10 其他文件
const OFFICE_EXTS = new Set(['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'pdf']);

// 各媒体类型的推送文案
const PUSH_LABELS = {
  image: '[图片]',
  audio: '[语音]',
  video: '[视频]',
};

/**
 * 组装 pushContent / pushPayload / custom
 *
 * 复刻自桌面端 home.98a203f1.js 的 jE() + Y() 函数。
 * 手机端依赖 pushPayload 里的 sessionID/sessionType 定位会话，缺失则消息无法渲染。
 *
 * @param {string|number} toUserId  接收人 user_id（数字）
 * @param {string} label  推送文案，文本消息传正文，媒体消息传 '[图片]' 等
 */
function buildPush(toUserId, label) {
  const session = loadSession();
  const to = String(toUserId);
  const sessionType = 0; // 0=p2p, 1=team
  const pushTitle = (session.user && (session.user.name_nick || session.user.name)) || '';

  const intent = `intent://com.huawei.codelabpush/deeplink?sessionID=${to}&sessionType=${sessionType}#Intent;scheme=pushscheme;launchFlags=0x4000000;end`;

  const payload = {
    pushTitle,
    sessionType,
    sessionID: to,
    to_user_id: to,
    channel_id: '101955',
    vivoField: { classification: '1', notification_channel: 'pre84' },
    oppoField: {
      channel_id: 'pre84', click_action_type: 4,
      click_action_activity: 'com.tal100.yach.main.activity.CommonNotificationActivity',
      notify_level: 16, category: 'IM',
      action_parameters: JSON.stringify({ sessionID: to, sessionType: String(sessionType) }),
    },
    hwField: {
      click_action: { intent, type: 1 },
      androidConfig: { category: 'IM' },
      badge: { add_num: 1, class: 'com.tal100.yach.main.activity.MainTabActivity' },
    },
    honorField: {
      notification: { clickAction: { intent, type: 1 }, importance: 'NORMAL' },
    },
    harmonyField: {
      payload: { notification: {
        category: 'IM', title: pushTitle, body: label,
        badge: { addNum: 1 },
        clickAction: { actionType: 0, data: { sessionType, sessionId: to } },
      }},
      pushOptions: { testMessage: false, ttl: 86400 },
    },
  };

  return {
    pushContent: label,
    pushPayload: JSON.stringify(payload),
    custom: JSON.stringify({ version: YACH_VERSION }),
  };
}

// ── 对外接口 ──────────────────────────────────────────────────

/**
 * 发送 P2P 文本消息
 * @param {string|number} toUserId  接收人 user.id
 * @param {string} text
 * @returns {Promise<{idServer, time, to}>}
 */
async function sendText(toUserId, text) {
  const nim = await getNim();
  const push = buildPush(toUserId, text);
  return withTimeout(new Promise((resolve, reject) => {
    nim.sendText({
      scene: 'p2p',
      to: String(toUserId),
      text,
      pushContent: push.pushContent,
      pushPayload: push.pushPayload,
      custom: push.custom,
      done(err, msg) {
        if (err) return reject(new Error(`sendText failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg));
      },
    });
  }), 'sendText');
}

/**
 * 发送 P2P 文件消息
 *
 * 上传到 NIM NOS → 登记到文件云盘 → custom type=5/10 发送。
 *
 * 关键结论（已验证 2026-07-12）：
 *   - NOS URL 手机端完全可识别， txt/zip 均可打开
 *   - 之前手机打不开的真正原因是：缺 pushPayload 或用了 NIM 原生 file 消息
 *   - custom type=5/10 + 完整 data 结构才是关键，URL 域名无关
 *
 * @param {string|number} toUserId
 * @param {string} filePath  本地文件路径
 * @returns {Promise<{idServer, time, to, file:{url, name, size}}>}
 */
async function sendFile(toUserId, filePath) {
  const nim = await getNim();
  filePath = resolveSafeFile(filePath);
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();

  // 1. 上传到 NIM NOS（比 COS 快，且手机端可打开）
  // 备用方案：const uploaded = await uploadToCos(filePath); fileUrl = uploaded.url;
  const blob = new (require('buffer').Blob)([buf], { type: 'application/octet-stream' });
  try { Object.defineProperty(blob, 'name', { value: name }); } catch {}
  const fileUrl = await withBrowserGlobalsAsync(() => new Promise((resolve, reject) => {
    nim.previewFile({
      type: 'file', blob,
      uploadprogress() {},
      done(err, file) {
        if (err) return reject(new Error(`previewFile failed: ${err.code} ${err.message}`));
        resolve(file.url);
      },
    });
  }));

  // 2. 登记到知音楼文件云盘，拿 relation_id + file_id（手机端渲染依赖）
  let relationId = '', fileId = '';
  try {
    const saveResp = await post('96file/file/info/save', {
      file_url: fileUrl,
      file_name: name,
      file_size: buf.length,
      file_mime: `file/${ext || 'bin'}`,
      file_extension: ext,
      source: 'person',
      receive_type: 1,
      receive_id: String(toUserId),
      is_dir: 0,
    });
    if (saveResp && saveResp.code === 200 && saveResp.obj) {
      relationId = String(saveResp.obj.relation_id || '');
      fileId = String(saveResp.obj.file_info?.file_id || '');
    }
  } catch (e) {
    console.error('[sendFile] fileInfoSave 失败（仍继续发送）:', e.message);
  }

  // 3. 构造 custom 消息（office/pdf 用 type=5，其他文件用 type=10）
  const customType = OFFICE_EXTS.has(ext) ? 5 : 10;
  const content = JSON.stringify({
    type: customType,
    data: { fileName: name, fileSize: buf.length, fileUrl, fileOriginUrl: fileUrl, id: fileId, relationId },
  });

  // 4. 发送
  const push = buildPush(toUserId, '[文件]');
  return withBrowserGlobalsAsync(() => new Promise((resolve, reject) => {
    nim.sendCustomMsg({
      scene: 'p2p', to: String(toUserId), content,
      pushContent: push.pushContent, pushPayload: push.pushPayload, custom: push.custom,
      done(err, msg) {
        if (err) return reject(new Error(`sendFile failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg, { file: { url: fileUrl, name, size: buf.length } }));
      },
    });
  }));
}

/**
 * 发送 P2P 图片消息
 * NIM 原生 image 消息，手机/PC 均可正常显示。
 *
 * @param {string|number} toUserId
 * @param {string} filePath  本地图片路径（png/jpg/gif/webp）
 * @returns {Promise<{idServer, time, to, file:{url, name, size}}>}
 */
async function sendImage(toUserId, filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' };
  return _sendMedia(toUserId, filePath, 'image', mimeMap[ext] || 'image/png');
}

/**
 * 发送 P2P 音频消息
 * @param {string|number} toUserId
 * @param {string} filePath  本地音频路径（mp3/wav/aac/amr）
 */
async function sendAudio(toUserId, filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac', amr: 'audio/amr', flac: 'audio/flac' };
  return _sendMedia(toUserId, filePath, 'audio', mimeMap[ext] || 'audio/mpeg');
}

/**
 * 发送 P2P 视频消息
 * @param {string|number} toUserId
 * @param {string} filePath  本地视频路径（mp4/mov/avi）
 */
async function sendVideo(toUserId, filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeMap = { mp4: 'video/mp4', avi: 'video/avi', mov: 'video/quicktime' };
  return _sendMedia(toUserId, filePath, 'video', mimeMap[ext] || 'video/mp4');
}

/**
 * 发送图文混排消息（图片 + 文字在同一条气泡）
 *
 * 使用 custom type=15 + Markdown 内容，图片先上传到 COS。
 * 来源：桌面端 CUSTOM_COMMON_MSG {type:15, data:{content:{contentType:1, content:"![](url)\ntext"}}}
 *
 * @param {string|number} toUserId
 * @param {string} imagePath  本地图片路径
 * @param {string} text  图片下方的文字
 * @returns {Promise<{idServer, time, to, imgUrl}>}
 */
async function sendImageWithText(toUserId, imagePath, text, scene = 'p2p') {
  const targetScene = normalizeScene(scene);
  const nim = await getNim();
  imagePath = resolveSafeFile(imagePath);

  // 上传图片到 NIM NOS
  // 备用方案：const uploaded = await uploadToCos(imagePath); imgUrl = uploaded.url;
  const imgBuf = fs.readFileSync(imagePath);
  const imgName = path.basename(imagePath);
  const imgExt = path.extname(imagePath).slice(1).toLowerCase();
  const mimeMap = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
  const imgBlob = new (require('buffer').Blob)([imgBuf], { type: mimeMap[imgExt] || 'image/png' });
  try { Object.defineProperty(imgBlob, 'name', { value: imgName }); } catch {}
  const imgUrl = await withBrowserGlobalsAsync(() => new Promise((resolve, reject) => {
    nim.previewFile({
      type: 'image', blob: imgBlob,
      uploadprogress() {},
      done(err, file) {
        if (err) return reject(new Error(`previewFile failed: ${err.code} ${err.message}`));
        resolve(file.url);
      },
    });
  }));

  // 构造 type=15 Markdown 内容（图片在上，文字在下）
  const markdown = `![图片](${imgUrl})\n${text}`;
  const summary = String(text || '').trim() || '图片消息';
  const content = JSON.stringify({
    type: 15,
    data: {
      textMsg: summary,
      textMsgPc: summary,
      content: { contentType: 1, content: markdown, contentPc: markdown, bgColor: '#fff', atHighlighted: [] },
      bgColor: '#FFFFFF',
      pushTitle: summary,
      pushBody: summary,
      pushContent: summary,
    },
  });

  const push = targetScene === 'team'
    ? buildTeamPush(toUserId, summary, loadSession().user?.name_nick || loadSession().user?.name || '')
    : buildPush(toUserId, summary);
  return withBrowserGlobalsAsync(() => new Promise((resolve, reject) => {
    nim.sendCustomMsg({
      scene: targetScene, to: String(toUserId), content,
      pushContent: push.pushContent, pushPayload: push.pushPayload,
      custom: JSON.stringify({ version: YACH_VERSION, ...(targetScene === 'team' ? { atHighlighted: [] } : {}) }),
      needPushNick: false,
      isPushable: true,
      isOfflinable: true,
      done(err, msg) {
        if (err) return reject(new Error(`sendImageWithText failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg, { imgUrl }));
      },
    });
  }));
}

function callNimQuery(nim, operation, invoke) {
  return withTimeout(new Promise((resolve, reject) => {
    try {
      invoke((err, data) => {
        if (err) return reject(new Error(`${operation} failed: ${err.code || ''} ${err.message || String(err)}`.trim()));
        resolve(data);
      });
    } catch (error) {
      reject(error);
    }
  }), operation);
}

function parseSessionId(sessionId) {
  const value = String(sessionId || '');
  const separator = value.indexOf(':');
  const scene = separator > 0 ? value.slice(0, separator).toLowerCase() : '';
  const id = separator > 0 ? value.slice(separator + 1) : '';
  if ((scene !== 'p2p' && scene !== 'team') || !id) {
    throw new Error('sessionId 格式应为 p2p:<uid> 或 team:<tid>');
  }
  return { scene, id };
}

/**
 * 从 NIM 云端拉取历史消息，不写入本地消息库。
 * 兼容旧调用：getHistory(userId, limit) 等同于 p2p:userId。
 */
async function getHistory(sessionOrUserId, limitOrOptions = 20) {
  const nim = await getNim();
  const options = typeof sessionOrUserId === 'object' && sessionOrUserId !== null
    ? sessionOrUserId
    : { sessionId: `p2p:${sessionOrUserId}`, limit: limitOrOptions };
  const { scene, id } = parseSessionId(options.sessionId);
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  const result = await callNimQuery(nim, 'getHistory', (done) => nim.getHistoryMsgs({
    scene,
    to: id,
    limit,
    endTime: Number(options.endTime) || 0,
    reverse: false,
    asc: true,
    done,
  }));
  return result?.msgs || [];
}

/** 当前长连接内存中的会话摘要；db:false 时不会读取/写入磁盘。 */
async function getSessions() {
  const nim = await getNim();
  if (typeof nim.getLocalSessions !== 'function') throw new Error('当前 NIM SDK 不支持内存会话列表');
  const result = await callNimQuery(nim, 'getSessions', (done) => nim.getLocalSessions({
    limit: 100,
    reverse: false,
    done,
  }));
  return result?.sessions || [];
}

/** NIM 云端全文检索；需要在 NIM 控制台开通全文云端检索能力。 */
async function searchMessages(keyword, limit = 20, sessionId) {
  const nim = await getNim();
  if (typeof nim.msgFtsInServer !== 'function') throw new Error('当前 NIM SDK 不支持云端消息全文搜索');
  // NIM's msgFtsInServer API rejects msgLimit above 10 with 414/7_26.
  // Keep the public tool honest by clamping to the SDK/backend limit.
  const query = { keyword: String(keyword || '').trim(), sessionLimit: 10, msgLimit: Math.max(1, Math.min(10, Number(limit) || 10)), order: 'DESC' };
  if (!query.keyword) throw new Error('keyword 必填');
  if (sessionId) {
    const { scene, id } = parseSessionId(sessionId);
    if (scene === 'p2p') query.p2pList = [id];
    else query.teamList = [id];
    query.sessionLimit = 1;
  }
  return callNimQuery(nim, 'searchMessages', (done) => nim.msgFtsInServer({ ...query, done }));
}

// ── 内部工具 ─────────────────────────────────────────────────

/** NIM sendFile 通用封装（图片/音频/视频） */
async function _sendMedia(toUserId, filePath, type, mime) {
  const nim = await getNim();
  filePath = resolveSafeFile(filePath);
  const buf = fs.readFileSync(filePath);
  const name = path.basename(filePath);
  const { Blob } = require('buffer');
  const blob = new Blob([buf], { type: mime });
  try { Object.defineProperty(blob, 'name', { value: name }); } catch {}

  const push = buildPush(toUserId, PUSH_LABELS[type] || '[文件]');
  return withBrowserGlobalsAsync(() => new Promise((resolve, reject) => {
    nim.sendFile({
      scene: 'p2p', to: String(toUserId), type, blob,
      pushContent: push.pushContent, pushPayload: push.pushPayload, custom: push.custom,
      uploaddone(err) { if (err) console.error(`[${type}] upload error:`, err); },
      done(err, msg) {
        if (err) return reject(new Error(`send${type} failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg, { file: { url: msg.file?.url, name, size: buf.length } }));
      },
    });
  }));
}

// ────────────────────────────────────────────────────────
// 卡片 / 投票 / @消息（均走 NIM 自定义消息）+ 消息搜索（HTTP）
// ────────────────────────────────────────────────────────

/**
 * 发卡片/富文本消息（Markdown，单条气泡）
 *
 * ⭐ 真实结构（已实测客户端可渲染，同 sendImageWithText）：
 *   CUSTOM_COMMON_MSG type=15，home.js 定义：
 *   { type:15, data:{ textMsg, textMsgPc, content:{ contentType:1, content:<markdown>, contentPc } } }
 *   之前用 { markdown } 结构错误→客户端“不支持的消息类型”。
 *
 * @param {string|number} toUserId
 * @param {object} card  { title, content, url? }
 * @param {'p2p'|'team'} scene  目标会话，默认 p2p
 */
async function sendCard(toUserId, card = {}, scene = 'p2p') {
  const targetScene = normalizeScene(scene);
  const nim = await getNim();
  // 拼成 markdown（标题加粗，正文，可选链接）
  const parts = [];
  if (card.title)   parts.push(`## ${card.title}`);
  if (card.content) parts.push(card.content);
  if (card.url)     parts.push(`[${card.url}](${card.url})`);
  const md = parts.join('\n\n');
  if (!md.trim()) throw new Error('卡片正文不能为空');
  const summary = card.title || card.content || '卡片消息';
  // ⭐ 真实结构（从二组大小屏精英团真实可渲染卡片抄来）：
  //   data.content 内层必须含 contentType/content/contentPc/bgColor/atHighlighted
  //   data 外层必须含 textMsg/textMsgPc/bgColor + pushTitle/pushBody/pushContent
  //   之前缺 bgColor/contentPc/atHighlighted → 客户端渲染空白
  const content = JSON.stringify({
    type: 15,
    data: {
      content: { contentType: 1, content: md, contentPc: md, bgColor: '#fff', atHighlighted: [] },
      textMsg: summary,
      textMsgPc: summary,
      bgColor: '#FFFFFF',
      pushTitle: summary,
      pushBody: summary,
      pushContent: summary,
    },
  });
  const push = targetScene === 'team'
    ? buildTeamPush(
      toUserId,
      summary,
      loadSession().user?.name_nick || loadSession().user?.name || '',
    )
    : buildPush(toUserId, summary);
  return withBrowserGlobalsAsync(() => withTimeout(new Promise((resolve, reject) => {
    nim.sendCustomMsg({
      scene: targetScene, to: String(toUserId), content,
      pushContent: push.pushContent, pushPayload: push.pushPayload,
      custom: JSON.stringify({ version: YACH_VERSION, ...(targetScene === 'team' ? { atHighlighted: [] } : {}) }),
      needPushNick: false,
      isPushable: true,
      isOfflinable: true,
      done(err, msg) {
        if (err) return reject(new Error(`sendCard failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg));
      },
    });
  }), 'sendCard'));
}

async function sendTeamCard(toTeamId, card = {}) {
  return sendCard(toTeamId, card, 'team');
}

/**
 * 发送群普通文本消息（不带 @）。
 *
 * 与 sendTeamTextWithAt 分开：普通群消息不应伪造 atAccids，也不应触发首页“@我”提醒登记。
 * @param {string|number} toTeamId 群 tid
 * @param {string} text
 * @returns {Promise<{idServer, time, to, scene}>}
 */
async function sendTeamText(toTeamId, text) {
  const message = String(text || '');
  if (!message.trim()) throw new Error('群消息正文不能为空');
  const nim = await getNim();
  const session = loadSession();
  const senderName = session.user && (session.user.name_nick || session.user.name) || '';
  const teamId = String(toTeamId);
  const push = buildTeamPush(teamId, message, senderName);

  return withTimeout(new Promise((resolve, reject) => {
    nim.sendText({
      scene: 'team',
      to: teamId,
      text: message,
      pushContent: push.pushContent,
      pushPayload: push.pushPayload,
      custom: JSON.stringify({ version: YACH_VERSION }),
      needPushNick: false,
      needMsgReceipt: true,
      isPushable: true,
      isOfflinable: true,
      done(err, msg) {
        if (err) return reject(new Error(`sendTeamText failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg));
      },
    });
  }), 'sendTeamText');
}

/**
 * 发投票（一步：只调 HTTP vote/create，服务端自动下发投票消息）
 *
 * ⭐ 真实协议（实测验证 2026-07-12，修正重复 bug）：
 *   仅需 POST bsvr/vote/create {title, optionContent:JSON, sessionId, entTime, isMultiple}
 *   → code:200, obj={vid, voteOption:[{op_id,content}], endTime, isMultiple, creator, sessionId}
 *   **服务端会自动向 sessionId 对应会话下发 type=32 投票消息 + 自动绑定**，客户端可直接点选统计。
 *
 *   ❌ 之前的坑：额外手动 NIM sendCustomMsg type=32 → 群里出现【两条】同 vid 投票（重复）！
 *      实测「只 create 不发 NIM」群里就自动出现 1 条投票 → 手动发 NIM 是多此一举。
 *   ❌ 更早的坑：猜 type=20（假 type）；漏 vote/msg/binding（其实 create 已自动绑定）。
 *
 *   ⭐ 投票是【纯群功能】（硬限制，源码实证 2026-07-12）：
 *   客户端投票入口渲染条件 = `!h && "team"===messageType` —— 只有群聊才有投票按钮；
 *   后端也只认群会话，p2p 无论怎么调 sessionId（裸 id / 群 tid / p2p- 前缀）点击都报“群组不存在”。
 *   → 投票只能发群（team tid）。私聊不支持原生投票（已放弃，不再借壳）。
 *
 * @param {string|number} to  team tid（投票仅支持群聊）
 * @param {object} vote  { title, options:[string], multi?:boolean, days?:number(结束天数,默认1) }
 * @param {'p2p'|'team'} scene  默认 team；传 p2p 会直接报错（投票不支持私聊）
 * @returns {Promise<object>} { vid, voteOption, endTime, isMultiple }
 */
async function sendVote(to, vote = {}, scene = 'team') {
  // ⭐ 投票仅群聊：p2p 直接拦截，避免发出一个点不了的死投票
  if (scene === 'p2p') {
    throw new Error('投票仅支持群聊（知音楼硬限制）：客户端只在群会话渲染投票按钮，p2p 点击报“群组不存在”。请传群 tid + scene=team。');
  }
  const endTime = Math.floor(Date.now() / 1000) + (vote.days ?? 1) * 86400;
  const created = await post('bsvr/vote/create', {
    title: vote.title,
    optionContent: JSON.stringify(vote.options || []),
    sessionId: String(to),
    entTime: String(endTime),
    isMultiple: vote.multi ? 1 : 0,
  });
  if (created.code !== 200) throw new Error(`vote/create failed: ${created.code} ${created.msg}`);
  // 服务端已自动下发投票消息，无需手动发 NIM（否则重复）
  return created.obj; // { vid, voteOption:[{op_id,content}], endTime, isMultiple, creator, sessionId }
}

/**
 * 发带 @ 的文本消息（群聊场景）
 * 知音楼客户端用 custom.atHighlighted 渲染蓝色 @，NIM apns 负责定向推送。
 * @param {string|number} toTeamId  群 tid
 * @param {string} text  正文（内含 @xxx）
 * @param {string[]} atAccids  被 @ 的成员 user.id，顺序须与正文 @ 标记一致；传 ['all'] 为 @全员
 */
function buildAtMessageMetadata(text, atAccids = []) {
  const message = String(text || '');
  const accounts = atAccids.map((value) => String(value).trim()).filter(Boolean);
  if (!message.trim()) throw new Error('@消息正文不能为空');
  if (!accounts.length) throw new Error('@消息至少需要一个 atAccids；@全员请传 ["all"]');

  const all = accounts.some((account) => account.toLowerCase() === 'all' || account === '-1');
  if (all && accounts.length !== 1) {
    throw new Error('@全员不能与指定成员混用');
  }

  if (all) {
    const match = /@(?:所有人|全员|全体成员|all)/iu.exec(message);
    if (!match) throw new Error('atAccids=["all"] 时，正文必须包含 @所有人、@全员、@全体成员或 @all');
    return {
      atHighlighted: [{
        id: '-1',
        index: match.index,
        atName: match[0],
        ei: match.index,
        en: '@all',
      }],
      apns: { accounts: ['-1'], content: message, forcePush: true },
    };
  }

  const markers = [...message.matchAll(/@[^\s@，,。；;!?！？]+/gu)];
  if (markers.length !== accounts.length) {
    throw new Error(`正文中的 @ 标记数 (${markers.length}) 与 atAccids 数量 (${accounts.length}) 不一致`);
  }
  return {
    atHighlighted: markers.map((match, index) => ({
      id: accounts[index],
      index: match.index,
      atName: match[0],
      ei: match.index,
      en: match[0],
    })),
    apns: { accounts, content: message, forcePush: true },
  };
}

function buildTeamPush(toTeamId, text, senderName = '') {
  const teamId = String(toTeamId);
  const pushContent = senderName ? `${senderName}: ${text}` : String(text);
  const intent =
    `intent://com.huawei.codelabpush/deeplink?sessionID=${teamId}&sessionType=1` +
    '#Intent;scheme=pushscheme;launchFlags=0x4000000;end';
  return {
    pushContent,
    pushPayload: JSON.stringify({
      pushTitle: '',
      sessionType: 1,
      sessionID: teamId,
      channel_id: '101975',
      vivoField: { classification: '1', notification_channel: 'pre213' },
      oppoField: {
        channel_id: 'pre213',
        category: 'IM',
        notify_level: 16,
        click_action_type: 4,
        click_action_activity: 'com.tal100.yach.main.activity.CommonNotificationActivity',
        action_parameters: JSON.stringify({ sessionID: teamId, sessionType: '1' }),
      },
      hwField: {
        click_action: { intent, type: 1 },
        androidConfig: { category: 'IM' },
        badge: { add_num: 1, class: 'com.tal100.yach.main.activity.MainTabActivity' },
      },
      honorField: {
        notification: { clickAction: { intent, type: 1 }, importance: 'NORMAL' },
      },
      harmonyField: {
        payload: {
          notification: {
            category: 'IM',
            title: pushContent.slice(0, 50),
            body: pushContent,
            badge: { addNum: 1 },
            clickAction: {
              actionType: 0,
              data: { sessionType: '1', sessionId: teamId },
            },
          },
        },
        pushOptions: { testMessage: false, ttl: 86400 },
      },
    }),
  };
}

function buildAtReminderPayload(teamId, msg, text, atHighlighted) {
  const atList = atHighlighted
    .map((highlight) => String(highlight.id || ''))
    .filter((id) => id && id !== '-1');
  if (!atList.length) return null;
  return {
    type: 'at',
    json: JSON.stringify({
      sessionId: String(teamId),
      serverId: msg.idServer,
      clientId: msg.idClient,
      fromAccount: msg.from,
      message: String(text),
      time: msg.time,
      fromType: 'group',
      ext: { atHighlighted },
      status: '0',
      atList,
      messageType: 'text',
    }),
  };
}

async function registerAtReminder(teamId, msg, text, atHighlighted) {
  const payload = buildAtReminderPayload(teamId, msg, text, atHighlighted);
  if (!payload) {
    return { registered: false, reason: '@全员提醒列表登记尚未验证，未发送 audio bus 请求' };
  }
  const response = await post('link/audio/bus/message/push/v1', payload);
  if (response && typeof response === 'object' && 'code' in response && Number(response.code) !== 200) {
    throw new Error(`audioBusMessagePush failed: ${response.code} ${response.msg || ''}`.trim());
  }
  return { registered: true };
}

async function sendTeamTextWithAt(toTeamId, text, atAccids = []) {
  const metadata = buildAtMessageMetadata(text, atAccids);
  const nim = await getNim();
  const session = loadSession();
  const senderName = session.user && (session.user.name_nick || session.user.name) || '';
  const teamId = String(toTeamId);
  const push = buildTeamPush(teamId, text, senderName);
  const custom = {
    version: YACH_VERSION,
    atHighlighted: metadata.atHighlighted,
  };
  metadata.apns.content = push.pushContent;
  const msg = await withTimeout(new Promise((resolve, reject) => {
    nim.sendText({
      scene: 'team', to: teamId, text,
      apns: metadata.apns,
      pushContent: push.pushContent,
      pushPayload: push.pushPayload,
      custom: JSON.stringify(custom),
      needPushNick: false,
      needMsgReceipt: true,
      isPushable: true,
      isOfflinable: true,
      done(err, msg) {
        if (err) return reject(new Error(`sendTeamTextWithAt failed: ${err.code} ${err.message}`));
        resolve(msg);
      },
    });
  }), 'sendTeamTextWithAt');

  let reminder;
  try {
    reminder = await registerAtReminder(teamId, msg, text, metadata.atHighlighted);
  } catch (error) {
    reminder = { registered: false, reason: error.message };
    // NIM 消息已经成功发送，不能抛错诱导调用方重发；将部分失败写入返回值。
    console.warn('[sendTeamTextWithAt] 提醒列表登记失败:', error.message);
  }
  return sentResult(msg, {
    reminderRegistered: reminder.registered,
    reminderError: reminder.registered ? '' : reminder.reason,
  });
}

/**
 * 撤回消息（NIM recallMsg）
 * @param {object} sentMsg  发送时返回的消息对象（需含 idClient/idServer/to/scene/from/time）
 *   或自行构造 { scene:'p2p', to, idServer, idClient, time, from }
 *   或传入 { raw: '<NIM msg JSON string>' } 从历史记录重建。
 * 知音楼当前实测没有 2 分钟限制。
 */
async function recallMessage(sentMsg) {
  const nim = await getNim();
  let msg;
  if (sentMsg && sentMsg._raw) {
    msg = sentMsg._raw;
  } else if (sentMsg && typeof sentMsg.raw === 'string') {
    try {
      msg = JSON.parse(sentMsg.raw);
    } catch {
      throw new Error('raw 不是有效的 NIM 消息 JSON');
    }
  } else {
    const required = ['idServer', 'idClient', 'to', 'scene', 'time', 'from'];
    const missing = required.filter((key) => sentMsg?.[key] === undefined || sentMsg?.[key] === '');
    if (missing.length) throw new Error(`撤回消息缺少字段: ${missing.join(', ')}`);
    const time = Number(sentMsg.time);
    if (!Number.isSafeInteger(time) || time < 1_000_000_000_000) {
      throw new Error('time 必须是精确的毫秒时间戳，不能使用秒级时间或格式化时间反推');
    }
    msg = {
      idServer: String(sentMsg.idServer),
      idClient: String(sentMsg.idClient),
      to: String(sentMsg.to),
      scene: sentMsg.scene,
      from: String(sentMsg.from),
      time,
      type: sentMsg.type || 'text',
      status: 'success',
    };
  }
  return withTimeout(new Promise((resolve, reject) => {
    nim.recallMsg({
      msg,
      ps: '撤回一条消息',
      done(err, obj) {
        if (err) return reject(new Error(`recallMessage failed: ${err.code} ${err.message}`));
        resolve(obj);
      },
    });
  }), 'recallMessage');
}

/**
 * 消息搜索：按 msgId 批量拉消息（HTTP）
 * CAPABILITY-MAP: bsvr/message/binding/getByMsgIds
 * @param {string[]} msgIds
 */
async function getMessagesByIds(msgIds = []) {
  const r = await post('bsvr/message/binding/getByMsgIds', {
    msg_ids: JSON.stringify(msgIds), cp_id: 1,
  });
  if (r.code !== 200) throw new Error(`getMessagesByIds failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 发机器人（AI 自动对话）消息 —— 群聊里 @ AI 机器人触发对话
 *
 * ⭐ 机制（云信 NIM SDK，实测）：旧的 sendRobotMsg 已被 SDK 标 @deprecated；
 *   现在用普通 sendText/sendCustomMsg + `robotInfo` 参数触发机器人：
 *     robotInfo = { account:<机器人账号>, function, topic, customContent }
 *   † robotInfo.account **仅群聊有效，p2p 会被忽略**（SDK 注释明确）。
 *   机器人账号从 ch3.listRobots() 拿。
 *
 * @param {string|number} toTeamId  群 tid（机器人对话仅群聊）
 * @param {string} text  发给机器人的问题文本
 * @param {string} robotAccount  机器人账号（accid）
 * @param {object} opts  { function?, topic?, customContent? }
 */
async function sendRobotMessage(toTeamId, text, robotAccount, opts = {}) {
  const nim = await getNim();
  const push = buildPush(toTeamId, text);
  const robotInfo = {
    account: String(robotAccount),
    function: opts.function || '',
    topic: opts.topic || '',
    customContent: opts.customContent || '',
  };
  return new Promise((resolve, reject) => {
    nim.sendText({
      scene: 'team',
      to: String(toTeamId),
      text,
      robotInfo,
      pushContent: push.pushContent,
      pushPayload: push.pushPayload,
      custom: push.custom,
      done(err, msg) {
        if (err) return reject(new Error(`sendRobotMessage failed: ${err.code} ${err.message}`));
        resolve(sentResult(msg));
      },
    });
  });
}

/**
 * 使用当前 yach-im-full NIM client 做语音转文字。
 * 只接受 NIM NOS 音频 URL；也可以用 sessionId + msgId 从 NIM 云端历史中定位音频。
 * 不依赖旧插件的本地 HTTP daemon。
 */
async function audioToText({ url, sessionId, msgId } = {}) {
  const nim = await getNim();
  let audioUrl = String(url || '').trim();
  if (!audioUrl && sessionId && msgId) {
    const messages = await getHistory({ sessionId, limit: 100 });
    const wanted = String(msgId);
    const message = messages.find((item) => String(item?.idServer || item?.id || item?.idClient || '') === wanted);
    audioUrl = String(
      message?.file?.url
      || message?.attach?.file?.url
      || message?.attach?.url
      || message?.fileUrl
      || '',
    ).trim();
  }
  if (!audioUrl) throw new Error('需要音频 url，或提供 sessionId + msgId 定位云端音频消息');
  if (typeof nim.audioToText !== 'function') throw new Error('当前 NIM SDK 不支持 audioToText');
  return withBrowserGlobalsAsync(() => new Promise((resolve, reject) => {
    nim.audioToText({
      url: audioUrl,
      done(error, text) {
        if (error) return reject(new Error(`audioToText failed: ${error.code || ''} ${error.message || String(error)}`.trim()));
        const transcript = text && typeof text === 'object'
          ? (text.text ?? text.audioToText?.text ?? '')
          : text;
        resolve(String(transcript || ''));
      },
    });
  }));
}

/**
 * 获取置顶会话列表（含 P2P 和群）
 * 路由：94capi/session/top/list（真调验证 2026-07-14）
 * 返回近・当前置顶的所有会话，含 id/name/pic/session_type。
 * session_type: "1"=P2P, "2"=群
 * @returns {Promise<Array<{id,name,pic,session_type,top_uid}>>}
 */
async function getTopSessions() {
  const r = await post('94capi/session/top/list', {});
  if (r.code !== 200) throw new Error(`getTopSessions failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 获取消息高亮列表（@ 我 / 稍后处理 / 关注 / 公告等）
 * 路由：link/audio/bus/highlight/pull/v1（真调验证 2026-07-14）
 *
 * 返回示例：
 *   { user_id, at: "1", later: "0", follow: "0", notice: "0", announcement: "0" }
 *   at="1" 表示有未读 @ 我的消息
 *
 * @returns {Promise<{user_id,at,later,follow,notice,announcement}>}
 */
async function getMessageHighlights() {
  const r = await get('link/audio/bus/highlight/pull/v1');
  if (r.code !== 200) throw new Error(`getMessageHighlights failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取消息 Bus 状态（at/follow/notice/announcement 开关）
 * 路由：link/audio/bus/status（真调验证 2026-07-14）
 * @returns {Promise<{status,at_status,follow_status,wait_status,announcement_status,notice_status}>}
 */
async function getMessageBusStatus() {
  const r = await get('link/audio/bus/status');
  if (r.code !== 200) throw new Error(`getMessageBusStatus failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取指定群的未读状态（是否有未读）
 * 路由：usergroup/group/unread（真调验证 2026-07-14）
 * @param {string[]} groupTids  群 tid 数组
 * @returns {Promise<Record<string, boolean>>}  { "tid": true/false }
 */
async function getGroupUnreadStatus(groupTids = []) {
  if (!groupTids.length) return {};
  const r = await post('usergroup/group/unread', {
    group_tids: groupTids.join(','),
  });
  if (r.code !== 200) throw new Error(`getGroupUnreadStatus failed: ${r.code} ${r.msg}`);
  return (r.obj && r.obj.data) || {};
}

module.exports = {
  sendText, sendFile, sendImage, sendAudio, sendVideo, sendImageWithText, getHistory, getSessions, searchMessages,
  sendCard, sendTeamCard, sendTeamText, sendVote, audioToText, buildAtMessageMetadata, buildTeamPush,
  buildAtReminderPayload, registerAtReminder, sendTeamTextWithAt,
  getMessagesByIds, recallMessage, sendRobotMessage,
  // ⭐ 新增（2026-07-14）
  getTopSessions,       // 置顶会话列表
  getMessageHighlights, // @我/稍后处理高亮状态
  getMessageBusStatus,  // 消息 Bus 开关状态
  getGroupUnreadStatus, // 群未读状态
};
