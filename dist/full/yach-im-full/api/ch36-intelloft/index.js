/**
 * 知小楼（Intelloft）H5 会话接口。
 *
 * 来源：yach-aio 2.1.5。这里按当前项目的运行时约定重新实现，
 * 不依赖来源项目的绝对路径、私有状态或自升级逻辑。
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const { get } = require('../../utils/request');
const { getSign } = require('../../utils/sign');

const CAPI_BASE = 'https://yach-capi.zhiyinlou.com';
const STREAM_BASE = 'https://yach-stream.zhiyinlou.com';
const CLIENT_VERSION = '1.9.19.12';
const TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_JSON_BYTES = 10 * 1024 * 1024;
const MAX_ANSWER_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 30_000;
const MAX_IMAGE_REDIRECTS = 2;
const TRUSTED_IMAGE_HOSTS = new Set([
  'yach-static.zhiyinlou.com',
  'nim-nosdn.netease.im',
  'yach-nos.netease.im',
]);

let h5TokenCache = null;

function tokenPath() {
  return 'memory://yach-im-full/intelloft-h5-token';
}

function readToken() {
  if (h5TokenCache?.accessToken && Number(h5TokenCache.expiresAt) > Date.now() + 30_000) {
    return { ...h5TokenCache };
  }
  return null;
}

function writeToken(value) {
  h5TokenCache = { ...value };
  return tokenPath();
}

async function refreshToken() {
  const payload = await get('609usergroup/get/h5/accesstoken', { source: 'squad' });
  const raw = Array.isArray(payload?.obj) ? payload.obj[0] : payload?.obj;
  const accessToken = String(raw?.token || '').trim();
  if (Number(payload?.code) !== 200 || !accessToken) {
    throw new Error(payload?.msg || '知小楼 H5 access token 获取失败');
  }
  const value = { accessToken, expiresAt: Date.now() + TOKEN_TTL_MS, updatedAt: Date.now() };
  writeToken(value);
  return value;
}

async function ensureToken(force = false) {
  return (!force && readToken()) || refreshToken();
}

function requestText(url, options, timeoutMs, maxBytes) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          res.destroy(new Error(`响应超过 ${maxBytes} bytes`));
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${text.slice(0, 300)}`));
          return;
        }
        resolve(text);
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('知小楼请求超时')));
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function h5Request(method, apiPath, values = {}, attempt = 0) {
  const params = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value ?? '')]),
  );
  const token = await ensureToken(attempt > 0);
  const { sign, timestamp } = getSign(params);
  const url = new URL(apiPath, CAPI_BASE);
  let body;
  if (method === 'GET') {
    url.search = querystring.stringify(params);
  } else {
    body = querystring.stringify(params);
  }
  const text = await requestText(url, {
    method,
    headers: {
      accesstoken: token.accessToken,
      sign,
      timestamp: String(timestamp),
      'client-ver': CLIENT_VERSION,
      Accept: 'application/json',
      ...(body ? {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
      } : {}),
    },
    body,
  }, 30_000, MAX_JSON_BYTES);
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error(`知小楼返回非 JSON：${text.slice(0, 200)}`); }
  if (Number(payload?.code) === 400000 && attempt === 0) {
    await refreshToken();
    return h5Request(method, apiPath, values, 1);
  }
  if (Number(payload?.code) !== 200) {
    throw new Error(payload?.msg || `知小楼请求失败: ${payload?.code}`);
  }
  return payload.obj;
}

function normalizeModel(raw = {}) {
  return {
    id: Number(raw.id || 0),
    name: String(raw.llm_model || ''),
    description: String(raw.llm_model_desc || ''),
    supportsDeepThinking: Number(raw.show_deep_thinking || 0) === 1,
    supportsVision: Number(raw.show_vision || 0) === 1,
    recommend: Number(raw.recommend || 0) === 1,
    uniqueKey: String(raw.unique_key || ''),
  };
}

function normalizeSession(raw = {}) {
  const options = raw?.skill?.skill_option || {};
  return {
    chatSessionId: String(raw.chat_session_id || ''),
    robotUid: String(raw.robot_uid || '3473'),
    robotType: String(raw.robot_type || '0'),
    robotName: String(raw.robot_name || ''),
    welcomeText: String(raw.welcome_text || ''),
    skillId: Number(raw?.skill?.skill_id || 1),
    models: Array.isArray(options.llm_model) ? options.llm_model.map(normalizeModel) : [],
    memory: raw.memory || {},
  };
}

async function listSkills() {
  const list = await h5Request('GET', '/636_ai/intelloft/skill/list');
  return (Array.isArray(list) ? list : []).map((item) => ({
    skillId: Number(item.skill_id || 0),
    skillName: String(item.skill_name || ''),
    iconUrl: String(item.icon || ''),
    isNew: Number(item.new_flag || 0) === 1,
  }));
}

async function createSession() {
  return normalizeSession(await h5Request('POST', '/636_ai/intelloft/session/new', {
    from_session_id: '0',
    from_session_type: '0',
    robot_uid: '3473',
    robot_type: '0',
  }));
}

async function listSessions(opts = {}) {
  const size = Math.min(Math.max(Number(opts.size) || 20, 1), 100);
  const wantAll = opts.all === true;
  let lastTime = opts.lastTime || '';
  const sessions = [];
  const seen = new Set();
  let unreadTotal = null;
  let hasMore = false;
  for (let page = 0; page < 500; page++) {
    const obj = await h5Request('GET', '/636_ai/intelloft/chat/session/list/new', {
      last_time: lastTime,
      size,
    });
    const rows = [...(Array.isArray(obj?.top_list) ? obj.top_list : []),
                  ...(Array.isArray(obj?.list) ? obj.list : [])];
    if (page === 0) unreadTotal = obj?.unread_total == null ? null : Number(obj.unread_total);
    let nextCursor = '';
    for (const item of rows) {
      const id = String(item.chat_session_id || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      sessions.push({
        chatSessionId: id,
        title: String(item.title || ''),
        robotUid: String(item.robot_uid || ''),
        robotName: String(item.robot_name || ''),
        skillId: item.skill_id == null ? null : Number(item.skill_id),
        lastTime: item.last_time == null ? '' : String(item.last_time),
      });
      if (item.last_time != null) nextCursor = String(item.last_time);
    }
    hasMore = Boolean(obj?.next);
    if (!wantAll) break;
    if (!rows.length || !hasMore) break;
    if (!nextCursor || nextCursor === lastTime) break;
    lastTime = nextCursor;
  }
  return {
    sessions,
    total: sessions.length,
    unreadTotal,
    hasMore: wantAll ? false : hasMore,
    nextCursor: wantAll ? null : (hasMore ? lastTime : null),
  };
}

async function getSessionInfo(chatSessionId) {
  return h5Request('GET', '/636_ai/intelloft/chat/session/info', {
    chat_session_id: String(chatSessionId),
  });
}

async function changeModel(chatSessionId, config, skillId = 1) {
  const skill = {
    llm_model: config.llmModel,
    deep_thinking: Number(config.deepThinking || 0),
    networking: Number(config.networking || 0),
    tool: Number(config.tool || 0),
  };
  return h5Request('POST', '/636_ai/intelloft/chat/change/llm', {
    chat_session_id: String(chatSessionId),
    llm_model: skill.llm_model,
    deep_thinking: skill.deep_thinking,
    networking: skill.networking,
    tool: skill.tool,
    skill_id: Number(skillId) || 1,
    skill: JSON.stringify(skill),
  });
}

function streamAnswer(recordId, msgId, accessToken) {
  return new Promise((resolve, reject) => {
    const values = { record_id: String(recordId), msg_id: String(msgId) };
    const { sign, timestamp } = getSign(values);
    const url = new URL('/636_ai/intelloft/message/receive', STREAM_BASE);
    url.search = querystring.stringify(values);
    const req = https.request(url, {
      method: 'GET',
      headers: {
        accesstoken: accessToken,
        sign,
        timestamp: String(timestamp),
        'client-ver': CLIENT_VERSION,
        Accept: 'text/event-stream, application/json',
      },
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`知小楼流式连接失败: HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let buffer = '';
      let answer = '';
      let bytes = 0;
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > MAX_ANSWER_BYTES) {
          res.destroy(new Error('知小楼回答超过大小限制'));
          return;
        }
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim().startsWith('data:')) continue;
          try {
            const event = JSON.parse(line.trim().slice(5).trim());
            if (event.type === 'text' && typeof event.content === 'string') {
              answer += event.content;
            }
            if (event.is_finished) {
              resolve(answer.trim());
              req.destroy();
              return;
            }
          } catch {}
        }
      });
      res.on('end', () => resolve(answer.trim()));
      res.on('error', reject);
    });
    req.setTimeout(5 * 60_000, () => req.destroy(new Error('知小楼回答超时')));
    req.on('error', reject);
    req.end();
  });
}

async function ask(question, opts = {}) {
  const bootstrap = await createSession();
  const chatSessionId = String(opts.chatSessionId || bootstrap.chatSessionId);
  if (!chatSessionId) throw new Error('知小楼会话创建失败');
  const requested = String(opts.model || '').toLowerCase();
  const model = (requested
    ? bootstrap.models.find((item) => [item.name, item.uniqueKey].some((v) => v.toLowerCase() === requested))
    : null) || bootstrap.models.find((item) => item.recommend) || bootstrap.models[0];
  if (!model?.name) throw new Error('知小楼没有返回可用模型');
  const skill = {
    llmModel: model.name,
    deepThinking: model.supportsDeepThinking && opts.deepThinking ? 1 : 0,
    networking: opts.networking ? 1 : 0,
    tool: opts.tool ? 1 : 0,
  };
  if (opts.model || opts.deepThinking || opts.networking || opts.tool) {
    await changeModel(chatSessionId, skill, bootstrap.skillId);
  }
  const result = await h5Request('POST', '/636_ai/intelloft/send/msg', {
    chat_session_id: chatSessionId,
    msg_content: JSON.stringify({ text: String(question) }),
    msg_type: 'text',
    from_session_id: '0',
    from_session_type: '0',
    robot_uid: bootstrap.robotUid,
    robot_type: bootstrap.robotType,
    is_rebuild: '0',
    skill: JSON.stringify({
      llm_model: skill.llmModel,
      deep_thinking: skill.deepThinking,
      networking: skill.networking,
      tool: skill.tool,
    }),
    skill_id: String(bootstrap.skillId),
  });
  const messages = Array.isArray(result?.list) ? result.list : [];
  const bot = messages.find((item) => Number(item.msg_from) === 2);
  if (!bot?.record_id || !bot?.msg_id) throw new Error('知小楼未返回机器人消息标识');
  const token = await ensureToken();
  const answer = await streamAnswer(bot.record_id, bot.msg_id, token.accessToken);
  return { chatSessionId, model: skill.llmModel, question, answer };
}

async function imageOcr(imageUrl) {
  const { post } = require('../../utils/request');
  const payload = await post('612meeting/aiimage/comeducation', { image_url: String(imageUrl) });
  if (Number(payload?.code) !== 200) throw new Error(payload?.msg || '知小楼图片识别失败');
  const raw = payload?.obj?.result ?? payload?.obj;
  const lines = (Array.isArray(raw) ? raw : [])
    .map((item) => String(typeof item === 'string' ? item : item?.texts || item?.text || item?.content || '').trim())
    .filter(Boolean);
  return { imageUrl, lines, fullText: lines.join('\n') };
}

function validateImageUrl(imageUrl) {
  let url;
  try {
    url = new URL(String(imageUrl || ''));
  } catch {
    throw new Error('图片 URL 无效');
  }
  if (url.protocol !== 'https:' || !TRUSTED_IMAGE_HOSTS.has(url.hostname)) {
    throw new Error(`不允许下载图片域名：${url.hostname || '(未知)'}`);
  }
  return url;
}

function downloadImage(url, targetPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const status = Number(res.statusCode || 0);
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.resume();
        if (redirectCount >= MAX_IMAGE_REDIRECTS || !res.headers.location) {
          reject(new Error('图片下载重定向次数过多'));
          return;
        }
        let next;
        try {
          next = validateImageUrl(new URL(res.headers.location, url).toString());
        } catch (error) {
          reject(error);
          return;
        }
        downloadImage(next, targetPath, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`下载图片失败: HTTP ${status}`));
        return;
      }
      const contentType = String(res.headers['content-type'] || '').toLowerCase();
      if (contentType && !contentType.startsWith('image/')) {
        res.resume();
        reject(new Error(`下载内容不是图片: ${contentType}`));
        return;
      }
      const declaredSize = Number(res.headers['content-length'] || 0);
      if (declaredSize > MAX_IMAGE_BYTES) {
        res.resume();
        reject(new Error(`图片超过 ${MAX_IMAGE_BYTES} bytes`));
        return;
      }
      const output = fs.createWriteStream(targetPath, { flags: 'wx', mode: 0o600 });
      let received = 0;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (received > MAX_IMAGE_BYTES) {
          res.destroy(new Error(`图片超过 ${MAX_IMAGE_BYTES} bytes`));
        }
      });
      res.on('error', (error) => {
        output.destroy();
        reject(error);
      });
      output.on('error', reject);
      output.on('finish', () => resolve(received));
      res.pipe(output);
    });
    req.setTimeout(IMAGE_DOWNLOAD_TIMEOUT_MS, () => req.destroy(new Error('图片下载超时')));
    req.on('error', reject);
  });
}

async function prepareImageForIntelloft(imageUrl) {
  const url = validateImageUrl(imageUrl);
  if (url.hostname === 'yach-static.zhiyinlou.com') {
    return { url: url.toString(), fileSize: 0 };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'haoweilai-intelloft-'));
  const sourceExtension = path.extname(url.pathname).toLowerCase();
  const safeExtension = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(sourceExtension)
    ? sourceExtension
    : '.png';
  const tempPath = path.join(tempDir, `image${safeExtension}`);
  try {
    const fileSize = await downloadImage(url, tempPath);
    const { uploadToCos } = require('../../utils/cos-upload');
    const uploaded = await uploadToCos(tempPath, { project: 'jsapi' });
    return { url: uploaded.url, fileSize };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function askWithImage(imageUrl, question, opts = {}) {
  const bootstrap = await createSession();
  const chatSessionId = String(opts.chatSessionId || bootstrap.chatSessionId);
  if (!chatSessionId) throw new Error('知小楼会话创建失败');

  const requested = String(opts.model || '').toLowerCase();
  const model = (requested
    ? bootstrap.models.find((item) => [item.name, item.uniqueKey].some((value) => value.toLowerCase() === requested))
    : null)
    || bootstrap.models.find((item) => item.supportsVision)
    || bootstrap.models.find((item) => item.recommend);
  if (!model?.name) throw new Error('知小楼没有可用的视觉模型');

  const skill = {
    llmModel: model.name,
    deepThinking: model.supportsDeepThinking && opts.deepThinking ? 1 : 0,
    networking: opts.networking ? 1 : 0,
    tool: opts.tool ? 1 : 0,
  };
  await changeModel(chatSessionId, skill, bootstrap.skillId);

  const prepared = await prepareImageForIntelloft(imageUrl);
  const extension = path.extname(new URL(prepared.url).pathname).toLowerCase();
  const fileName = `image${['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension) ? extension : '.png'}`;
  const result = await h5Request('POST', '/636_ai/intelloft/send/msg', {
    chat_session_id: chatSessionId,
    msg_content: JSON.stringify({
      text: String(question || '请分析这张图片的内容'),
      files: [{
        fileName,
        fileId: crypto.randomBytes(8).toString('hex'),
        percent: 1,
        fileType: 'image',
        fileSize: prepared.fileSize,
        fileUrl: prepared.url,
        relationId: crypto.randomBytes(10).toString('hex'),
        width: 0,
        height: 0,
      }],
    }),
    msg_type: 'mix_file',
    from_session_id: '0',
    from_session_type: '0',
    robot_uid: bootstrap.robotUid,
    robot_type: bootstrap.robotType,
    is_rebuild: '0',
    skill: JSON.stringify({
      llm_model: skill.llmModel,
      deep_thinking: skill.deepThinking,
      networking: skill.networking,
      tool: skill.tool,
    }),
    skill_id: String(bootstrap.skillId),
  });
  const messages = Array.isArray(result?.list) ? result.list : [];
  const bot = messages.find((item) => Number(item.msg_from) === 2);
  if (!bot?.record_id || !bot?.msg_id) throw new Error('知小楼未返回机器人消息标识');
  const token = await ensureToken();
  const answer = await streamAnswer(bot.record_id, bot.msg_id, token.accessToken);
  return { chatSessionId, model: skill.llmModel, question, answer, imageUrl: prepared.url };
}

// ── 会话管理 ──────────────────────────────────────────────
async function deleteSession(chatSessionId) {
  return h5Request('POST', '/636_ai/intelloft/chat/delete/sesion', {
    chat_session_id: String(chatSessionId),
  });
}

async function updateSessionTitle(chatSessionId, title) {
  return h5Request('POST', '/636_ai/intelloft/chat/update/sesion/title', {
    chat_session_id: String(chatSessionId),
    title: String(title || ''),
  });
}

async function topSession(chatSessionId, isTop = true) {
  return h5Request('POST', '/636_ai/intelloft/chat/session/top', {
    chat_session_id: String(chatSessionId),
    is_top: isTop ? '1' : '0',
  });
}

async function continueChat(chatSessionId) {
  return h5Request('POST', '/636_ai/intelloft/chat/continue', {
    chat_session_id: String(chatSessionId),
  });
}

// ── 消息操作 ──────────────────────────────────────────────
async function stopMessage(recordId, msgId) {
  return h5Request('POST', '/636_ai/intelloft/message/stop', {
    record_id: String(recordId),
    msg_id: String(msgId),
  });
}

async function repeatMessage(chatSessionId, recordId, msgId) {
  return h5Request('POST', '/636_ai/intelloft/message/repeate', {
    chat_session_id: String(chatSessionId),
    record_id: String(recordId),
    msg_id: String(msgId),
  });
}

async function listMessages(chatSessionId, opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/msg/list', {
    chat_session_id: String(chatSessionId),
    size: Math.min(Math.max(Number(opts.size) || 20, 1), 100),
    last_time: opts.lastTime || '',
  });
}

async function feedbackMessage(msgId, opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/msg/feedback', {
    msg_id: String(msgId),
    feedback_type: String(opts.feedbackType || ''),
    feedback_content: opts.content || '',
    tags: Array.isArray(opts.tags) ? opts.tags.join(',') : String(opts.tags || ''),
  });
}

async function listFeedbackTags() {
  return h5Request('GET', '/636_ai/intelloft/msg/feedback/tags');
}

// ── 文件转换 ──────────────────────────────────────────────
async function convertFile(opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/msg/convert/online/file', {
    file_url: String(opts.fileUrl || ''),
    file_name: opts.fileName || '',
    file_type: opts.fileType || '',
  });
}

async function convertProgress(taskId) {
  return h5Request('GET', '/636_ai/intelloft/msg/convert/process', {
    task_id: String(taskId),
  });
}

// ── Agent 技能 ────────────────────────────────────────────
async function listAgentSkills(opts = {}) {
  return h5Request('GET', '/636_ai/intelloft/agent/skill/list', {
    size: Math.min(Math.max(Number(opts.size) || 20, 1), 100),
    last_time: opts.lastTime || '',
  });
}

async function listAgentSkillCategories() {
  return h5Request('GET', '/636_ai/intelloft/agent/skill/cate/list');
}

async function searchAgentSkills(keyword, opts = {}) {
  return h5Request('GET', '/636_ai/intelloft/agent/skill/search', {
    keyword: String(keyword || ''),
    size: Math.min(Math.max(Number(opts.size) || 20, 1), 100),
  });
}

async function getAgentSkillInfo(skillId) {
  return h5Request('GET', '/636_ai/intelloft/agent/skill/info', {
    skill_id: String(skillId),
  });
}

async function listQuickAgentSkills() {
  return h5Request('GET', '/636_ai/intelloft/agent/skill/quick/list');
}

async function createAgentSkill(opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/agent/skill/create', {
    skill_name: String(opts.skillName || ''),
    description: opts.description || '',
    content: opts.content || '',
    category_id: String(opts.categoryId || ''),
  });
}

async function updateAgentSkill(opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/agent/skill/update', {
    skill_id: String(opts.skillId || ''),
    skill_name: opts.skillName || '',
    description: opts.description || '',
    content: opts.content || '',
  });
}

async function deleteAgentSkill(skillId) {
  return h5Request('POST', '/636_ai/intelloft/agent/skill/del', {
    skill_id: String(skillId),
  });
}

async function installAgentSkill(skillId) {
  return h5Request('POST', '/636_ai/intelloft/agent/skill/install', {
    skill_id: String(skillId),
  });
}

async function shareAgentSkill(skillId, opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/agent/skill/share', {
    skill_id: String(skillId),
    target_users: Array.isArray(opts.targetUsers)
      ? opts.targetUsers.join(',')
      : String(opts.targetUsers || ''),
  });
}

async function useAgentSkill(skillId, chatSessionId) {
  return h5Request('POST', '/636_ai/intelloft/agent/skill/use', {
    skill_id: String(skillId),
    chat_session_id: chatSessionId ? String(chatSessionId) : '',
  });
}

// ── AI 搜索 ────────────────────────────────────────────────
async function aiseekSend(question, opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/search/aiseek/send/msg', {
    msg_content: JSON.stringify({ text: String(question || '') }),
    session_id: opts.sessionId || '',
    model: opts.model || '',
  });
}

async function aiseekContinue(sessionId, opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/search/aiseek/session/continue', {
    session_id: String(sessionId),
    msg_content: JSON.stringify({ text: String(opts.question || '') }),
  });
}

// ── 其他 ───────────────────────────────────────────────────
async function listDigitalPartners() {
  return h5Request('GET', '/636_ai/intelloft/digital/partner/list');
}

async function searchGroupUsers(keyword, opts = {}) {
  return h5Request('GET', '/636_ai/intelloft/group/users/search', {
    keyword: String(keyword || ''),
    size: Math.min(Math.max(Number(opts.size) || 20, 1), 100),
  });
}

async function listHelpwriteTags() {
  return h5Request('GET', '/636_ai/intelloft/helpwrite/tag/list');
}

async function getTmpDownloadUrl(opts = {}) {
  return h5Request('GET', '/636_ai/intelloft/common/file/tmp/download/url', {
    file_id: String(opts.fileId || ''),
    file_url: opts.fileUrl || '',
  });
}

async function readNotification(notificationId) {
  return h5Request('POST', '/636_ai/intelloft/notification/read', {
    notification_id: String(notificationId),
  });
}

async function listOptions() {
  return h5Request('GET', '/636_ai/intelloft/option/list');
}

async function changeOption(opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/option/change', {
    option_key: String(opts.optionKey || ''),
    option_value: String(opts.optionValue ?? ''),
  });
}

async function getUrlInfo(url) {
  return h5Request('GET', '/636_ai/intelloft/url/info', {
    url: String(url || ''),
  });
}

async function getUserGuide() {
  return h5Request('GET', '/636_ai/intelloft/user/guide');
}

async function listVersionHistory() {
  return h5Request('GET', '/636_ai/intelloft/version/history');
}

async function getSkillDetail(skillId) {
  return h5Request('GET', '/636_ai/intelloft/skill/detail', {
    skill_id: String(skillId),
  });
}

async function sendGroupSummaryMessage(opts = {}) {
  return h5Request('POST', '/636_ai/intelloft/send/summary/group/users/msg', {
    chat_session_id: String(opts.chatSessionId || ''),
    user_ids: Array.isArray(opts.userIds)
      ? opts.userIds.join(',')
      : String(opts.userIds || ''),
    content: opts.content || '',
  });
}

module.exports = {
  ensureToken,
  listSkills,
  createSession,
  listSessions,
  getSessionInfo,
  changeModel,
  ask,
  askWithImage,
  imageOcr,
  deleteSession,
  updateSessionTitle,
  topSession,
  continueChat,
  stopMessage,
  repeatMessage,
  listMessages,
  feedbackMessage,
  listFeedbackTags,
  convertFile,
  convertProgress,
  listAgentSkills,
  listAgentSkillCategories,
  searchAgentSkills,
  getAgentSkillInfo,
  listQuickAgentSkills,
  createAgentSkill,
  updateAgentSkill,
  deleteAgentSkill,
  installAgentSkill,
  shareAgentSkill,
  useAgentSkill,
  aiseekSend,
  aiseekContinue,
  listDigitalPartners,
  searchGroupUsers,
  listHelpwriteTags,
  getTmpDownloadUrl,
  readNotification,
  listOptions,
  changeOption,
  getUrlInfo,
  getUserGuide,
  listVersionHistory,
  getSkillDetail,
  sendGroupSummaryMessage,
  _internals: {
    normalizeModel,
    normalizeSession,
    tokenPath,
    validateImageUrl,
    downloadImage,
    prepareImageForIntelloft,
  },
};
