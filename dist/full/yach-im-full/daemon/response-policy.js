/**
 * NIM 自动响应策略。
 *
 * 这份策略只决定“哪些入站消息可以触发 Agent”，不保存消息正文。
 * 规则来自插件配置：
 * {
 *   responsePolicy: {
 *     enabled: true,
 *     p2pAllow: ["user.id"],
 *     groupAlways: ["team.tid"],
 *     groupMention: ["team.tid"]
 *   }
 * }
 */

const DEFAULT_RESPONSE_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_CONCURRENT = 2;
const DEFAULT_QUEUE_LIMIT = 50;
const DEFAULT_MAX_REPLY_CHARS = 6_000;

function asIdList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => String(item ?? '').trim())
    .filter(Boolean))];
}

function pickPolicyRoot(configOrPolicy) {
  const pluginConfig = configOrPolicy?.plugins?.entries?.['yach-im-full']?.config;
  return pluginConfig?.responsePolicy
    || configOrPolicy?.responsePolicy
    || configOrPolicy
    || {};
}

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeResponsePolicy(configOrPolicy) {
  const raw = pickPolicyRoot(configOrPolicy);
  const groups = raw.groups && typeof raw.groups === 'object' ? raw.groups : {};
  return {
    enabled: raw.enabled === true,
    p2pAllow: asIdList(raw.p2pAllow ?? raw.p2p?.allow ?? raw.p2p?.allowFrom),
    groupAlways: asIdList(raw.groupAlways ?? groups.always),
    groupMention: asIdList(raw.groupMention ?? groups.mention),
    agentId: String(raw.agentId || 'main').trim() || 'main',
    model: String(raw.model || '').trim() || undefined,
    timeoutMs: boundedInteger(raw.timeoutMs, DEFAULT_RESPONSE_TIMEOUT_MS, 5_000, 120_000),
    maxConcurrent: boundedInteger(raw.maxConcurrent, DEFAULT_MAX_CONCURRENT, 1, 8),
    queueLimit: boundedInteger(raw.queueLimit, DEFAULT_QUEUE_LIMIT, 1, 200),
    maxReplyChars: boundedInteger(raw.maxReplyChars, DEFAULT_MAX_REPLY_CHARS, 200, 20_000),
    respondToOffline: raw.respondToOffline === true,
    respondToBots: raw.respondToBots === true,
  };
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  let current = value;
  for (let i = 0; i < 3; i += 1) {
    try {
      const next = JSON.parse(current);
      if (next === current) return next;
      current = next;
    } catch {
      return current;
    }
  }
  return current;
}

function isMentionContainer(key) {
  const normalized = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized.startsWith('at')
    || normalized.includes('mention')
    || normalized === 'accounts';
}

function collectMentionIds(value, key, ids, depth = 0, seen = new Set()) {
  if (depth > 5 || value == null) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    if (isMentionContainer(key)) ids.add(String(value));
    return;
  }
  if (typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectMentionIds(item, key, ids, depth + 1, seen);
    return;
  }

  for (const [childKey, childValue] of Object.entries(value)) {
    if (isMentionContainer(childKey)) {
      if (typeof childValue === 'string' || typeof childValue === 'number') {
        ids.add(String(childValue));
      } else if (Array.isArray(childValue)) {
        for (const item of childValue) {
          if (typeof item === 'string' || typeof item === 'number') ids.add(String(item));
          else if (item && typeof item === 'object') {
            for (const idKey of ['id', 'account', 'accid', 'userId', 'user_id']) {
              if (typeof item[idKey] === 'string' || typeof item[idKey] === 'number') {
                ids.add(String(item[idKey]));
              }
            }
            collectMentionIds(item, childKey, ids, depth + 1, seen);
          }
        }
      } else {
        if (childValue && typeof childValue === 'object') {
          for (const idKey of ['id', 'account', 'accid', 'userId', 'user_id']) {
            if (typeof childValue[idKey] === 'string' || typeof childValue[idKey] === 'number') {
              ids.add(String(childValue[idKey]));
            }
          }
        }
        collectMentionIds(childValue, childKey, ids, depth + 1, seen);
      }
    }
    if (typeof childValue === 'object' && childValue !== null) {
      collectMentionIds(childValue, childKey, ids, depth + 1, seen);
    }
  }
}

function messageMentionIds(msg) {
  const ids = new Set();
  for (const value of [msg?.custom, msg?.ext, msg?.content, msg?.atHighlighted, msg?.mentions]) {
    collectMentionIds(parseJson(value), '', ids);
  }
  return ids;
}

function hasMentionForSelf(msg, selfId, selfNames = []) {
  const normalizedSelfId = String(selfId || '').trim();
  const ids = messageMentionIds(msg);
  if (normalizedSelfId && ids.has(normalizedSelfId)) return true;
  if (ids.has('-1') || ids.has('all')) return true;

  const text = String(msg?.text || '').trim();
  if (!text) return false;
  return selfNames
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .some((name) => text.includes(`@${name}`));
}

function extractText(msg) {
  if (String(msg?.type || '').toLowerCase() !== 'text') return '';
  return String(msg?.text || '').trim();
}

function isBotMessage(msg) {
  return msg?.isBot === true
    || Boolean(msg?.robotInfo)
    || Boolean(msg?.robotAccount)
    || String(msg?.fromClientType || '').toLowerCase().includes('bot');
}

/**
 * 返回触发类型：p2p、group-always、group-mention，未命中返回 null。
 */
function resolveResponseRule(msg, { selfId, selfNames = [], policy } = {}) {
  const normalized = normalizeResponsePolicy(policy);
  if (!normalized.enabled || !msg) return null;
  if (String(msg.from ?? '') === String(selfId ?? '')) return null;
  if (!normalized.respondToBots && isBotMessage(msg)) return null;

  const scene = String(msg.scene || '').toLowerCase();
  if (scene === 'p2p' && normalized.p2pAllow.includes(String(msg.from ?? ''))) {
    return 'p2p';
  }
  if (scene !== 'team') return null;

  const teamId = String(msg.to ?? '');
  if (normalized.groupAlways.includes(teamId)) return 'group-always';
  if (
    normalized.groupMention.includes(teamId)
    && hasMentionForSelf(msg, selfId, selfNames)
  ) return 'group-mention';
  return null;
}

module.exports = {
  DEFAULT_RESPONSE_TIMEOUT_MS,
  normalizeResponsePolicy,
  messageMentionIds,
  hasMentionForSelf,
  extractText,
  resolveResponseRule,
};
