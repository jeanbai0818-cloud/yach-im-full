export const YACH_GROUP_RESPONSE_MODES = ["all", "humans", "mentions", "paired"];
const GROUP_MODE_DEFAULTS = {
    all: { requireMention: false, allowBots: true, pairedOnly: false },
    humans: { requireMention: false, allowBots: false, pairedOnly: false },
    // Mention gating is independent from sender kind. This keeps bot messages
    // in the received/pending window and lets a bot message trigger a reply when
    // it explicitly @s Yach IM, matching the install default requested for Yach IM.
    mentions: { requireMention: true, allowBots: true, pairedOnly: false },
    paired: { requireMention: false, allowBots: false, pairedOnly: true },
};
const AT_MARKUP_RE = /<at\b[^>]*?\bid\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>(?:\s*<\/at>)?/giu;
const STRUCTURED_MENTION_FIELDS = [
    "mentionedUsers", "mentionedUserIds", "mentioned_user_ids", "mentionUsers",
    "mentions", "atUsers", "at_users", "atUserIds", "at_user_ids",
];
const STRUCTURED_MENTION_NAME_FIELDS = [
    "mentionedUserNames", "mentioned_user_names", "mentionNames", "atNames", "at_names",
];
const ID_KEYS = ["id", "userId", "user_id", "userid", "userID", "uid", "targetId", "target_id"];
const NAME_KEYS = ["name", "userName", "user_name", "username", "displayName", "display_name", "atName", "at_name"];
function asRecord(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : undefined;
}
function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}
function parseJsonValue(value) {
    if (typeof value !== "string")
        return value;
    const trimmed = value.trim();
    if (!trimmed || !["[", "{"].includes(trimmed[0] ?? ""))
        return value;
    try {
        return JSON.parse(trimmed);
    }
    catch {
        return value;
    }
}
function nonEmptyString(value) {
    if (typeof value === "string" && value.trim())
        return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
        return String(value);
    return undefined;
}
function uniqueStrings(values) {
    return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean)));
}
function normalizeAllowList(value) {
    if (!Array.isArray(value))
        return [];
    return uniqueStrings(value.map((entry) => String(entry)));
}
function optionalAllowList(value) {
    return Array.isArray(value) ? normalizeAllowList(value) : undefined;
}
function normalizeComparable(value) {
    return value.trim().toLocaleLowerCase();
}
function sameIdentity(left, right) {
    return normalizeComparable(left) === normalizeComparable(right);
}
function collectScalarStrings(value, output) {
    const parsed = parseJsonValue(value);
    if (parsed !== value) {
        collectScalarStrings(parsed, output);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            collectScalarStrings(item, output);
        return;
    }
    const text = nonEmptyString(value);
    if (text)
        output.add(text);
}
function collectStructuredMentions(value, ids, names, depth = 0) {
    if (depth > 4)
        return;
    const parsed = parseJsonValue(value);
    if (parsed !== value) {
        collectStructuredMentions(parsed, ids, names, depth + 1);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            collectStructuredMentions(item, ids, names, depth + 1);
        return;
    }
    const record = asRecord(value);
    if (!record)
        return;
    for (const key of ID_KEYS) {
        const id = nonEmptyString(record[key]);
        if (id)
            ids.add(id);
    }
    for (const key of NAME_KEYS) {
        const name = nonEmptyString(record[key]);
        if (name)
            names.add(name.replace(/^@/u, "").trim());
    }
    for (const key of ["users", "list", "items", "data", "value"]) {
        if (hasOwn(record, key))
            collectStructuredMentions(record[key], ids, names, depth + 1);
    }
}
function extractMarkupIds(text) {
    const ids = [];
    for (const match of text.matchAll(AT_MARKUP_RE)) {
        const id = match[1] ?? match[2];
        if (id?.trim())
            ids.push(id.trim());
    }
    return ids;
}
function extractTextMentionIds(text) {
    return Array.from(text.matchAll(/@([\p{L}\p{N}_-]+)/gu), (match) => match[1]).filter(Boolean);
}
function stripBotDisplaySuffix(value) {
    return value.replace(/\s*\([^)]*\)\s*$/u, "").trim();
}
function botNameVariants(value) {
    if (!value?.trim())
        return [];
    const full = value.trim().replace(/^@/u, "");
    return uniqueStrings([full, stripBotDisplaySuffix(full)]);
}
function escapedRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function textMentionsName(text, name) {
    const escaped = escapedRegExp(name);
    if (!escaped)
        return false;
    return new RegExp(`(?:^|[\\s([<{,，、])@${escaped}(?=$|[\\s\\])}>.,，。！？!?、:：;；])`, "iu").test(text);
}
function readBooleanSignal(record, keys) {
    for (const key of keys) {
        if (!hasOwn(record, key))
            continue;
        const value = record[key];
        if (typeof value === "boolean")
            return value;
        if (typeof value === "string") {
            if (/^(?:true|yes|1)$/iu.test(value.trim()))
                return true;
            if (/^(?:false|no|0)$/iu.test(value.trim()))
                return false;
        }
        if (typeof value === "number" && (value === 0 || value === 1))
            return value === 1;
    }
    return undefined;
}
function readRecords(message) {
    const records = [message];
    const parsed = parseJsonValue(message.userJson);
    const add = (value, depth) => {
        if (depth > 3)
            return;
        const record = asRecord(value);
        if (!record)
            return;
        records.push(record);
        for (const key of ["user", "sender", "data", "profile"]) {
            if (hasOwn(record, key))
                add(record[key], depth + 1);
        }
    };
    add(parsed, 0);
    return records;
}
function readReplyToBotSignal(message) {
    for (const record of readRecords(message)) {
        const signal = readBooleanSignal(record, [
            "replyToBot", "reply_to_bot", "isReplyToBot", "is_reply_to_bot",
            "quotedBot", "quoted_bot", "quoteIsBot", "quote_is_bot",
        ]);
        if (signal !== undefined)
            return signal;
    }
    return false;
}
export function normalizeYachGroupResponseMode(value) {
    if (typeof value !== "string")
        return undefined;
    const normalized = value.trim().toLocaleLowerCase();
    return YACH_GROUP_RESPONSE_MODES.includes(normalized)
        ? normalized
        : undefined;
}
export function normalizeYachAllowBots(value) {
    if (value === true || value === false || value === "mentions")
        return value;
    return undefined;
}
/** Replace Yach's rich @ tag with a stable textual token for agent context. */
export function normalizeYachMentionMarkup(text) {
    return text.replace(AT_MARKUP_RE, (_match, doubleQuoted, singleQuoted) => {
        const id = doubleQuoted ?? singleQuoted ?? "";
        return id ? `@${id}` : "";
    });
}
export function resolveYachMentionFacts(params) {
    const message = params.message;
    const text = normalizeYachMentionMarkup(params.text);
    // The inbound body is normalized before it reaches this resolver, so read
    // both the provider's rich tag and the stable @id form produced above.
    const mentionedUserIds = new Set([
        ...extractMarkupIds(params.text),
        ...extractTextMentionIds(text),
    ]);
    const mentionedNames = new Set();
    let structured = false;
    if (message) {
        const record = message;
        for (const field of STRUCTURED_MENTION_FIELDS) {
            if (!hasOwn(record, field))
                continue;
            structured = true;
            collectStructuredMentions(record[field], mentionedUserIds, mentionedNames);
        }
        for (const field of STRUCTURED_MENTION_NAME_FIELDS) {
            if (!hasOwn(record, field))
                continue;
            structured = true;
            collectScalarStrings(record[field], mentionedNames);
        }
    }
    const botIds = uniqueStrings([params.botId ?? ""]);
    const botNames = botNameVariants(params.botName);
    const ids = Array.from(mentionedUserIds);
    const names = Array.from(mentionedNames);
    const idMatch = botIds.some((botId) => ids.some((id) => sameIdentity(botId, id)));
    const structuredNameMatch = botNames.some((botName) => names.some((name) => sameIdentity(botName, name.replace(/^@/u, ""))));
    const textNameMatch = botNames.some((botName) => textMentionsName(text, botName));
    const replyToBot = params.replyToBot ?? (message ? readReplyToBotSignal(message) : false);
    const mentionSource = idMatch || structuredNameMatch
        ? (structured || ids.length > 0 ? "structured" : "markup")
        : textNameMatch
            ? "text"
            : replyToBot
                ? "reply"
                : ids.length > 0 || names.length > 0 || /@[\p{L}\p{N}_-]+/u.test(text)
                    ? structured || ids.length > 0 ? "structured" : "text"
                    : undefined;
    const hasAnyMention = ids.length > 0 || names.length > 0 || /@[\p{L}\p{N}_-]+/u.test(text);
    const canDetectMention = Boolean(botIds.length || botNames.length || replyToBot);
    const wasMentioned = idMatch || structuredNameMatch || textNameMatch || replyToBot;
    return {
        canDetectMention,
        wasMentioned,
        hasAnyMention,
        explicitlyMentionedBot: idMatch || structuredNameMatch || textNameMatch,
        mentionedUserIds: ids,
        mentionedNames: names,
        mentionSource,
        implicitMentionKinds: replyToBot ? ["reply_to_bot"] : [],
    };
}
/** Identify bot-authored and self-authored events from Yach callback metadata. */
export function resolveYachBotFacts(message, senderId, knownBotIds = []) {
    const records = readRecords(message);
    const sources = new Set();
    let explicitBot;
    let explicitSelf;
    let typeBot = false;
    let workCodeBot = false;
    for (const record of records) {
        const botSignal = readBooleanSignal(record, [
            "isBot", "is_bot", "senderIsBot", "sender_is_bot", "isRobot", "is_robot", "bot",
        ]);
        if (botSignal !== undefined) {
            explicitBot = explicitBot === true || botSignal;
            if (botSignal)
                sources.add("isBot");
        }
        const selfSignal = readBooleanSignal(record, ["isSelf", "is_self", "senderIsSelf", "sender_is_self"]);
        if (selfSignal !== undefined) {
            explicitSelf = explicitSelf === true || selfSignal;
            if (selfSignal)
                sources.add("isSelf");
        }
        for (const key of ["senderType", "sender_type", "userType", "user_type", "senderUserType", "sender_user_type", "type"]) {
            if (!hasOwn(record, key))
                continue;
            const value = nonEmptyString(record[key]);
            if (!value)
                continue;
            if (/^(?:2|bot|robot|app|assistant|service)$/iu.test(value)) {
                typeBot = true;
                sources.add(key);
            }
        }
        for (const key of ["workCode", "work_code"]) {
            if (!hasOwn(record, key))
                continue;
            const value = nonEmptyString(record[key]);
            if (value === "-1") {
                workCodeBot = true;
                sources.add(key);
            }
        }
    }
    const knownIds = uniqueStrings(knownBotIds.filter((value) => Boolean(value?.trim())));
    const selfById = knownIds.some((knownId) => sameIdentity(knownId, senderId));
    if (selfById)
        sources.add("botIdentity");
    const isSelf = explicitSelf === true || selfById;
    const isBot = isSelf || explicitBot === true || typeBot || workCodeBot;
    return {
        isBot,
        isSelf,
        reliable: sources.size > 0,
        sources: Array.from(sources),
    };
}
/** Remove only this bot's leading mention; mentions addressed to other users remain visible. */
export function stripYachBotMention(text, params) {
    let remaining = normalizeYachMentionMarkup(text).trim();
    const candidates = uniqueStrings([
        params.botId ?? "",
        ...botNameVariants(params.botName),
    ]).sort((left, right) => right.length - left.length);
    let changed = true;
    while (changed && remaining) {
        changed = false;
        for (const candidate of candidates) {
            const escaped = escapedRegExp(candidate);
            const match = remaining.match(new RegExp(`^@${escaped}(?:\\s+|[,，:：;；]|$)`, "iu"));
            if (!match)
                continue;
            remaining = remaining.slice(match[0].length).trim();
            changed = true;
            break;
        }
    }
    return remaining;
}
function readGroupScope(config, conversationId) {
    const groups = asRecord(config.groups);
    if (!groups)
        return { hasGroupsMap: false, matched: true, enabled: true };
    const exact = asRecord(groups[conversationId]);
    const wildcard = asRecord(groups["*"]);
    if (!exact && !wildcard)
        return { hasGroupsMap: true, matched: false, enabled: false };
    const merged = { ...(wildcard ?? {}), ...(exact ?? {}) };
    return {
        hasGroupsMap: true,
        matched: true,
        enabled: merged.enabled !== false,
        config: merged,
        matchedKey: exact ? conversationId : "*",
    };
}
export function resolveYachGroupResponseSettings(config, conversationId) {
    const scope = readGroupScope(config, conversationId);
    const scopeConfig = scope.config;
    // The install-time default is fail-closed: only explicitly allowed groups
    // are active. Explicit mode/policy settings still override this default.
    const mode = normalizeYachGroupResponseMode(scopeConfig?.groupResponseMode ?? config.groupResponseMode) ?? "mentions";
    const modeDefaults = GROUP_MODE_DEFAULTS[mode];
    const rootRequireMention = typeof config.requireMention === "boolean" ? config.requireMention : undefined;
    const scopedRequireMention = typeof scopeConfig?.requireMention === "boolean" ? scopeConfig.requireMention : undefined;
    const rootAllowBots = normalizeYachAllowBots(config.allowBots);
    const scopedAllowBots = normalizeYachAllowBots(scopeConfig?.allowBots);
    const scopedSenderAllowFrom = scopeConfig && hasOwn(scopeConfig, "allowFrom")
        ? optionalAllowList(scopeConfig.allowFrom) ?? []
        : undefined;
    const senderAllowFrom = scopedSenderAllowFrom ?? optionalAllowList(config.groupSenderAllowFrom);
    return {
        mode,
        requireMention: scopedRequireMention ?? rootRequireMention ?? modeDefaults.requireMention,
        allowBots: scopedAllowBots ?? rootAllowBots ?? modeDefaults.allowBots,
        pairedOnly: modeDefaults.pairedOnly,
        senderAllowFrom,
        scope,
    };
}
export function resolveYachGroupRoomAccess(account, conversationId) {
    const groupPolicy = account.groupPolicy ?? "allowlist";
    if (groupPolicy === "disabled")
        return { allowed: false, reason: "group-policy-disabled" };
    const settings = resolveYachGroupResponseSettings(account.config, conversationId);
    if (!settings.scope.matched) {
        // An absent entry is only allowed in explicit open mode. A matched
        // entry with enabled:false remains an explicit opt-out.
        if (groupPolicy === "open")
            return { allowed: true, reason: "allowed" };
        return { allowed: false, reason: "group-not-configured" };
    }
    if (!settings.scope.enabled)
        return { allowed: false, reason: "group-disabled" };
    // In open mode a groups map is an override map, not an implicit allowlist.
    // An exact/wildcard entry can disable or customize a group; an unmatched
    // group remains allowed because the bot was invited into it.
    if (groupPolicy === "open")
        return { allowed: true, reason: "allowed" };
    const legacyEntries = normalizeAllowList(account.groupAllowFrom);
    const legacyConfigured = legacyEntries.length > 0;
    const legacyAllowed = legacyEntries.includes("*") || legacyEntries.includes(conversationId);
    const mapAllowed = !settings.scope.hasGroupsMap || settings.scope.matched;
    if (!legacyConfigured && !settings.scope.hasGroupsMap) {
        return { allowed: false, reason: "group-allowlist-empty" };
    }
    if ((legacyConfigured && !legacyAllowed) || !mapAllowed) {
        return { allowed: false, reason: "group-allowlist-unauthorized" };
    }
    return { allowed: true, reason: "allowed" };
}
export function isYachSenderAllowed(senderId, allowFrom) {
    if (allowFrom === undefined)
        return true;
    return allowFrom.includes("*") || allowFrom.some((entry) => sameIdentity(entry, senderId));
}
export function groupResponseModeDefaults(mode) {
    return { ...GROUP_MODE_DEFAULTS[mode] };
}
//# sourceMappingURL=group-response.js.map
