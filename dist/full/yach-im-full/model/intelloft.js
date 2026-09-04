/**
 * 知小楼 Model Service。
 *
 * 为守护进程和其他内部模块提供统一的文本、图片和批量分析接口。
 * 网络超时、响应大小、图片域名和临时文件清理由底层 ch36-intelloft 负责。
 */
const intelloft = require('../api/ch36-intelloft');

const SESSION_TTL_MS = 30 * 60 * 1000;
let cachedSession = null;
let sessionPromise = null;

async function getSession() {
  if (cachedSession && Date.now() - cachedSession.createdAt < SESSION_TTL_MS) {
    return cachedSession;
  }
  if (!sessionPromise) {
    sessionPromise = intelloft.createSession()
      .then((session) => {
        cachedSession = { ...session, createdAt: Date.now() };
        return cachedSession;
      })
      .finally(() => {
        sessionPromise = null;
      });
  }
  return sessionPromise;
}

function pickModel(models, opts = {}) {
  const list = Array.isArray(models) ? models : [];
  let candidates = list;
  if (opts.vision) candidates = candidates.filter((model) => model.supportsVision);
  if (opts.thinking) candidates = candidates.filter((model) => model.supportsDeepThinking);
  const preferred = String(opts.preferName || '').toLowerCase();
  if (preferred) {
    const match = candidates.find((model) => (
      [model.name, model.uniqueKey].some((value) => String(value || '').toLowerCase() === preferred)
    ));
    if (match) return match;
  }
  return candidates.find((model) => model.recommend) || candidates[0] || null;
}

async function listModels() {
  return (await getSession()).models;
}

async function ask(question, opts = {}) {
  const text = String(question || '').trim();
  if (!text) throw new Error('question 必填');
  const session = await getSession();
  const model = pickModel(session.models, {
    thinking: Boolean(opts.deepThinking),
    preferName: opts.model,
  });
  if (!model?.name) throw new Error('知小楼无可用模型');
  return intelloft.ask(text, {
    chatSessionId: session.chatSessionId,
    model: model.name,
    deepThinking: Boolean(opts.deepThinking),
    networking: Boolean(opts.networking),
    tool: Boolean(opts.tool),
  });
}

async function askWithImage(imageUrl, prompt, opts = {}) {
  const session = await getSession();
  const model = pickModel(session.models, {
    vision: true,
    preferName: opts.model,
  });
  if (!model?.name) throw new Error('知小楼无可用视觉模型');
  return intelloft.askWithImage(
    imageUrl,
    String(prompt || '请分析这张图片的内容'),
    {
      chatSessionId: session.chatSessionId,
      model: model.name,
      deepThinking: Boolean(opts.deepThinking),
      networking: Boolean(opts.networking),
      tool: Boolean(opts.tool),
    },
  );
}

async function analyzeImage(imageUrl) {
  const result = await askWithImage(
    imageUrl,
    '请分析这张图片：1）图片类型；2）主要内容；3）关键信息。请简洁回复。',
  );
  return result.answer;
}

async function analyzeText(text, instruction = '请分析以下内容并总结要点') {
  const result = await ask(`${instruction}：\n\n${String(text || '')}`);
  return result.answer;
}

async function batchAsk(items) {
  if (!Array.isArray(items)) throw new Error('items 必须是数组');
  const results = [];
  for (const item of items) {
    try {
      const result = await ask(item?.question, item?.opts || {});
      results.push({ answer: result.answer, error: null });
    } catch (error) {
      results.push({ answer: null, error: error.message });
    }
  }
  return results;
}

function clearSessionCache() {
  cachedSession = null;
  sessionPromise = null;
}

module.exports = {
  raw: intelloft,
  getSession,
  listModels,
  pickModel,
  ask,
  askWithImage,
  analyzeImage,
  analyzeText,
  batchAsk,
  clearSessionCache,
};
