'use strict';

// NIM custom 消息的 content 是 JSON 字符串，且不同版本的知音楼客户端把正文放在
// data.textMsg、data.textMsgPc 或 data.content.content/contentPc 中。历史消息在展示时
// 解码原始 NIM envelope，兼容不同客户端版本。

const MAX_DECODED_TEXT = 12_000;
const TEXT_KEYS = new Set([
  'text', 'textmsg', 'textmsgpc', 'content', 'contentpc',
  'pushcontent', 'pushbody', 'pushtitle', 'title', 'body',
  'description', 'message', 'msg', 'summary', 'reply_content',
  'replycontent', 'content_text', 'contenttext', 'newtitle',
  'subject', 'answer', 'question', 'notice', 'label',
]);
const METADATA_KEYS = /^(url|fileurl|fileoriginurl|imageurl|coverurl|expressionurl|id|vid|opid|sessionid|creator|account|userid|atuid|type|contenttype|filesize|filename|name|bgcolor|enttime|endtime|ismultiple|expressionid|streamid|sourceid|password|token|zoomtoken|zoomzak)$/i;

function parseNestedJson(value, maxDepth = 4) {
  let current = value;
  for (let depth = 0; depth < maxDepth && typeof current === 'string'; depth++) {
    const text = current.trim();
    if (!text || !/^[\[{]/.test(text)) break;
    try {
      current = JSON.parse(text);
    } catch {
      break;
    }
  }
  return current;
}

function normalizeCustomType(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const match = String(value ?? '').match(/(?:custom|msgtype|type)[^\d]*(\d+)/i);
  return match ? Number(match[1]) : NaN;
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(x[\da-f]+|\d+);/gi, (_, code) => {
      const value = code[0].toLowerCase() === 'x'
        ? Number.parseInt(code.slice(1), 16)
        : Number.parseInt(code, 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : _;
    });
}

/**
 * 将 Markdown/HTML 富文本变成适合 Agent 阅读的纯文本。
 * 图片只保留 alt 文本，避免把 NOS/CDN URL 当成正文返回。
 */
function normalizeRichText(value) {
  if (value == null) return '';
  const input = String(value).replace(/\r\n?/g, '\n').trim();
  if (!input) return '';

  let text = input
    .replace(/<img\b[^>]*\balt=["']([^"']*)["'][^>]*>/gi, '[图片：$1]')
    .replace(/<img\b[^>]*>/gi, '[图片]')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt) => alt ? `[图片：${alt}]` : '[图片]')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr|blockquote)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1');

  text = decodeHtmlEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text.slice(0, MAX_DECODED_TEXT);
}

function addCandidate(candidates, value, key = '', priority = 0) {
  const parsed = parseNestedJson(value);
  if (typeof parsed !== 'string') return;
  const text = normalizeRichText(parsed);
  if (!text || METADATA_KEYS.test(key) || /^https?:\/\//i.test(text)) return;
  if (text.length < 2 && !/[\u4e00-\u9fffA-Za-z0-9]/u.test(text)) return;
  candidates.push({ text, key: key.toLowerCase(), priority });
}

function collectTextCandidates(value, candidates, depth = 0, key = '') {
  if (depth > 4 || value == null) return;
  const parsed = parseNestedJson(value);
  if (typeof parsed === 'string') {
    if (TEXT_KEYS.has(key.toLowerCase())) addCandidate(candidates, parsed, key, 10);
    return;
  }
  if (Array.isArray(parsed)) {
    for (const item of parsed) collectTextCandidates(item, candidates, depth + 1, key);
    return;
  }
  if (typeof parsed !== 'object') return;
  for (const [childKey, childValue] of Object.entries(parsed)) {
    const normalizedKey = childKey.toLowerCase();
    if (TEXT_KEYS.has(normalizedKey)) addCandidate(candidates, childValue, childKey, 20);
    if (!METADATA_KEYS.test(childKey)) {
      collectTextCandidates(childValue, candidates, depth + 1, childKey);
    }
  }
}

function distinctTexts(values) {
  const result = [];
  for (const value of values) {
    const text = normalizeRichText(value);
    if (!text) continue;
    if (result.some((existing) => existing === text || existing.includes(text))) continue;
    for (let index = result.length - 1; index >= 0; index--) {
      if (text.includes(result[index])) result.splice(index, 1);
    }
    result.push(text);
  }
  return result;
}

function decodeVote(data) {
  const title = normalizeRichText(data?.title || data?.voteTitle || data?.textMsg || '');
  let options = parseNestedJson(data?.voteOption || data?.options || data?.optionContent);
  if (typeof options === 'string') options = [];
  if (!Array.isArray(options)) options = [];
  const optionTexts = options
    .map((item) => normalizeRichText(typeof item === 'string' ? item : item?.content || item?.name || ''))
    .filter(Boolean);
  const lines = [];
  if (title) lines.push(`投票：${title}`);
  if (optionTexts.length) lines.push(`选项：${optionTexts.join(' / ')}`);
  return lines.join('\n');
}

function firstText(...values) {
  for (const value of values) {
    if (value != null && typeof value === 'object') continue;
    const text = normalizeRichText(value);
    if (text) return text;
  }
  return '';
}

function isMessagePlaceholder(text) {
  return /^\[(?:图片|文件|音频|语音|视频|自定义消息)(?::[^\]]+)?\]$/u.test(
    String(text || '').trim(),
  );
}

function decodeReplyCard(data) {
  const content = parseNestedJson(data?.content);
  const reply = firstText(
    data?.reply_content,
    data?.replyContent,
    content?.reply_content,
    content?.replyContent,
  );
  return reply ? `引用消息：${reply}` : '';
}

function decodeLinkCard(data) {
  const title = firstText(data?.title, data?.textMsg, data?.textMsgPc);
  const description = firstText(data?.description, data?.content, data?.pushBody);
  const url = String(data?.url || '').trim();
  const lines = [];
  if (title) lines.push(`卡片：${title}`);
  if (description && description !== title) lines.push(description);
  if (/^https?:\/\//i.test(url)) lines.push(`链接：${url}`);
  return lines.join('\n');
}

function isGenericCustomText(text) {
  return /^\[(?:自定义消息|custom)(?:：[^\]]*)?\]$/i.test(String(text || '').trim());
}

/**
 * 解码一条 NIM custom 消息，兼容字符串或对象形式的 JSON payload。
 * @param {string|object} rawContent messages.content
 * @param {{mediaName?: string, imageText?: string}} [opts]
 * @returns {string}
 */
function decodeCustomMessage(rawContent, opts = {}) {
  const parsed = parseNestedJson(rawContent);
  if (typeof parsed === 'string') {
    const text = parsed.trim();
    if (/^[\[{]/.test(text)) {
      return opts.mediaName ? `[自定义消息：${normalizeRichText(opts.mediaName)}]` : '[自定义消息]';
    }
    return normalizeRichText(text) || '[自定义消息]';
  }
  if (!parsed || typeof parsed !== 'object') return '[自定义消息]';

  const type = normalizeCustomType(parsed.type ?? parsed.msgType ?? parsed.customType);
  const data = parseNestedJson(parsed.data) || {};
  const mediaName = normalizeRichText(opts.mediaName || data.fileName || data.name || '');
  const imageText = normalizeRichText(opts.imageText || '');

  if (type === 8) {
    const image = mediaName ? `[图片：${mediaName}]` : '[图片]';
    return imageText ? `${image}\n图片内容：${imageText}` : image;
  }
  if (type === 5 || type === 10) {
    return mediaName ? `[文件：${mediaName}]` : '[文件]';
  }
  if (type === 32) {
    const vote = decodeVote(data);
    if (vote) return vote;
  }
  if (type === 38 || type === 39) {
    const reply = decodeReplyCard(data);
    if (reply) return reply;
  }
  if (type === 23) {
    const linkCard = decodeLinkCard(data);
    if (linkCard) return linkCard;
  }
  if (type === 25) {
    const expression = firstText(data.expressionName, data.expressionName_en);
    return expression ? `[表情：${expression}]` : '[表情]';
  }
  if (type === 30) {
    const videoName = firstText(data.fileName, data.name);
    return videoName ? `[视频：${videoName}]` : '[视频]';
  }
  if (type === 40) {
    const name = firstText(data.name, data.nameNick);
    return name ? `[用户卡片：${name}]` : '[用户卡片]';
  }
  if (type === 19) {
    return '[系统卡片]';
  }

  const candidates = [];
  const richContent = parseNestedJson(data?.content);
  if (richContent && typeof richContent === 'object') {
    addCandidate(candidates, richContent.contentPc, 'contentPc', 100);
    addCandidate(candidates, richContent.content, 'content', 100);
  } else {
    addCandidate(candidates, richContent, 'content', 100);
  }
  addCandidate(candidates, data.textMsgPc, 'textMsgPc', 90);
  addCandidate(candidates, data.textMsg, 'textMsg', 90);
  addCandidate(candidates, data.pushBody, 'pushBody', 80);
  addCandidate(candidates, data.pushContent, 'pushContent', 80);
  addCandidate(candidates, data.pushTitle, 'pushTitle', 70);
  addCandidate(candidates, parsed.text, 'text', 60);
  addCandidate(candidates, parsed.textMsg, 'textMsg', 60);
  collectTextCandidates(data, candidates);

  const texts = distinctTexts(candidates
    .sort((left, right) => right.priority - left.priority)
    .map((candidate) => candidate.text));
  if (texts.length) return texts.join('\n').slice(0, MAX_DECODED_TEXT);
  return mediaName ? `[自定义消息：${mediaName}]` : '[自定义消息]';
}

function decodeCustomFromMessage(message, opts = {}) {
  const sources = [message?.content];
  const raw = parseNestedJson(message?.raw);
  if (raw && typeof raw === 'object') {
    sources.push(raw.content, raw.custom, raw.data);
  }

  let fallback = '[自定义消息]';
  let decoded = fallback;
  for (const source of sources) {
    if (source == null || source === '') continue;
    const candidate = decodeCustomMessage(source, opts);
    if (!isGenericCustomText(candidate)) {
      decoded = candidate;
      break;
    }
    fallback = candidate;
    decoded = candidate;
  }

  // 转发消息（常见 custom type=6/7）会把发送者实际输入放在 NIM
  // envelope 的顶层 text，而把被转发内容放在 content。数据库保留了
  // raw，但历史/搜索之前只解码 content，导致“转发告警 + 人工原因”
  // 的原因被静默丢掉。保留外层文本，同时过滤图片等仅用于预览的占位符。
  const outerText = firstText(message?.text, raw?.text);
  if (!outerText || isMessagePlaceholder(outerText)) return decoded || fallback;
  if (isGenericCustomText(decoded)) return outerText;
  return distinctTexts([outerText, decoded]).join('\n') || decoded || fallback;
}

/**
 * 为历史、搜索和会话预览生成统一的可读消息正文。
 * @param {object} message 数据库行或 NIM 原始消息
 * @param {{maxLength?: number}} [opts]
 * @returns {string}
 */
function formatMessageBody(message, { maxLength = MAX_DECODED_TEXT } = {}) {
  const type = String(message?.type || '').toLowerCase();
  let body;
  if (type === 'text') {
    body = message.text ?? message.content ?? '';
  } else if (type === 'audio') {
    body = message.audio_text
      ? `[语音转文字] ${message.audio_text}`
      : `[语音] ${message.media_name || message.file?.name || '未转写'}`;
  } else if (type === 'image') {
    const name = message.media_name || message.file?.name || '';
    body = message.image_text
      ? `[图片${name ? `：${name}` : ''}]\n图片内容：${message.image_text}`
      : (name ? `[图片：${name}]` : '[图片]');
  } else if (type === 'file' || type === 'video') {
    const label = type === 'file' ? '文件' : '视频';
    body = `[${label}${message.media_name ? `：${message.media_name}` : ''}]`;
  } else if (type === 'custom') {
    body = decodeCustomFromMessage(message, {
      mediaName: message.media_name || message.file?.name,
      imageText: message.image_text,
    });
  } else if (type === 'notification') {
    body = message.text ?? message.content ?? '[系统通知]';
  } else {
    body = message.text ?? message.content ?? `[${type || '消息'}]`;
  }
  return normalizeRichText(body).slice(0, Math.max(1, Number(maxLength) || MAX_DECODED_TEXT));
}

module.exports = {
  decodeCustomMessage,
  decodeCustomFromMessage,
  formatMessageBody,
  normalizeRichText,
  normalizeCustomType,
  parseNestedJson,
};
