import { hasControlCommand, resolveSenderCommandAuthorization } from "openclaw/plugin-sdk/command-auth";
import { isNormalizedSenderAllowed } from "openclaw/plugin-sdk/allow-from";
import { createChannelPartialDeliveryError, resolveInboundMentionDecision, toInboundMediaFacts, } from "openclaw/plugin-sdk/channel-inbound";
import { resolveStableChannelMessageIngress } from "openclaw/plugin-sdk/channel-ingress-runtime";
import { createMessageReceiptFromOutboundResults } from "openclaw/plugin-sdk/channel-outbound";
import { chunkMarkdownTextWithMode } from "openclaw/plugin-sdk/reply-runtime";
import { createChannelHistoryWindow } from "openclaw/plugin-sdk/reply-history";
import { aesDecrypt } from "./aes.js";
import { enqueueChatTask } from "./chat-queue.js";
import { getMessageDedup, isMessageExpired } from "./dedup.js";
import { getYachRuntime } from "./plugin-runtime.js";
import { YachClient } from "./oapi.js";
import { transformModelTextToFoldLinks } from "./model-fold-links.js";
import { YachStreamingCard } from "./streaming-card.js";
import { chooseYachTypingExpression, resolveYachExpressionScene } from "./typing-expression.js";
import { yachOutbound, resolveYachTarget } from "./outbound.js";
import { isYachSenderAllowed, normalizeYachMentionMarkup, resolveYachBotFacts, resolveYachGroupResponseSettings, resolveYachGroupRoomAccess, resolveYachMentionFacts, stripYachBotMention, } from "./group-response.js";
import { createTypingCallbacks } from "openclaw/plugin-sdk/channel-outbound";
const HANDLED_MESSAGE_TYPES = new Set([
    "text", "audio", "image", "file", "video", "reply", "fold", "link", "merge_forward", "start_new_session", "callback",
]);
const MAX_YACH_HISTORY_KEYS = 1_000;
const fallbackHistoryMaps = new Map();
function getFallbackHistoryMap(accountId) {
    const existing = fallbackHistoryMaps.get(accountId);
    if (existing)
        return existing;
    const historyMap = new Map();
    fallbackHistoryMaps.set(accountId, historyMap);
    return historyMap;
}
function stringValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function decryptRequired(value, appKey, field) {
    const input = stringValue(value);
    if (!input)
        throw new Error(`missing encrypted ${field}`);
    return aesDecrypt(input, appKey);
}
function decryptOptional(value, appKey) {
    const input = stringValue(value);
    return input ? aesDecrypt(input, appKey) : undefined;
}
function decryptOptionalBestEffort(value, appKey) {
    const input = stringValue(value);
    if (!input)
        return undefined;
    try {
        return aesDecrypt(input, appKey);
    }
    catch {
        // Some Yach IM deployments send chatbotUserId in plaintext even though the
        // other identifiers are encrypted. Keep the value for identity matching.
        return input;
    }
}
function messageBody(message) {
    if (message.msgtype === "start_new_session")
        return "/new";
    if (message.msgtype === "fold") {
        const content = stringValue(message.content) ?? "";
        const match = content.match(/[?&]reply=(.*)$/u);
        if (!match?.[1])
            return content;
        try {
            return decodeURIComponent(match[1]);
        }
        catch {
            return match[1];
        }
    }
    if (message.msgtype === "audio" && stringValue(message.audio_text))
        return message.audio_text;
    if (message.msgtype === "image") {
        const image = stringValue(message.content);
        let ocr = "";
        if (message.image_recognize_code === 200 && typeof message.image_text === "string") {
            try {
                const parts = JSON.parse(message.image_text);
                ocr = parts.map((part) => part.texts ?? "").filter(Boolean).join("\n");
            }
            catch {
                ocr = "";
            }
        }
        return [image ? `![图片](${image})` : "", ocr].filter(Boolean).join("\n\n");
    }
    return normalizeYachMentionMarkup(message.content ?? "");
}
function senderName(message, senderId) {
    let name = message.senderNickName ?? message.senderNick ?? senderId;
    let tag;
    if (typeof message.userJson === "string") {
        try {
            const user = JSON.parse(message.userJson);
            if (user.name)
                name = user.name;
            const lines = [
                user.workCode ? `work_code: ${user.workCode}` : "",
                user.name ? `name: ${user.name}` : "",
                user.deptName ? `department: ${user.deptName}` : "",
            ].filter(Boolean);
            if (lines.length)
                tag = lines.join("\n");
        }
        catch {
            // Optional user metadata is not required for delivery.
        }
    }
    return { name, tag };
}
function mediaPayload(message) {
    const type = message.msgtype;
    if (!["image", "audio", "video", "file"].includes(type ?? ""))
        return {};
    const url = stringValue(message.content);
    if (!url)
        return {};
    return { MediaUrls: [url], MediaUrl: url };
}
function timestampMs(value) {
    if (typeof value === "number" && Number.isFinite(value))
        return value < 1_000_000_000_000 ? value * 1_000 : value;
    if (typeof value === "string") {
        const numeric = Number(value);
        if (Number.isFinite(numeric) && value.trim())
            return numeric < 1_000_000_000_000 ? numeric * 1_000 : numeric;
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed))
            return parsed;
    }
    return Date.now();
}
function parseHistory(message, limit) {
    if (limit <= 0 || !message.historyChatRecord)
        return undefined;
    const raw = Array.isArray(message.historyChatRecord)
        ? message.historyChatRecord
        : (() => {
            try {
                const parsed = JSON.parse(message.historyChatRecord);
                return Array.isArray(parsed) ? parsed : [];
            }
            catch {
                return [];
            }
        })();
    const mediaLabel = {
        image: "图片",
        file: "文件",
        video: "视频",
        audio: "语音",
        media: "媒体",
    };
    const history = raw.map((entry) => {
        const value = entry && typeof entry === "object" ? entry : {};
        const type = stringValue(value.type);
        const content = stringValue(value.content) ?? stringValue(value.text) ?? stringValue(value.body) ?? "";
        const body = mediaLabel[type ?? ""]
            ? `[${mediaLabel[type ?? ""]}${content ? `: ${content}` : ""}]`
            : content;
        return {
            sender: stringValue(value.senderName) ?? stringValue(value.sender) ?? "Yach IM user",
            body,
            timestamp: timestampMs(value.time ?? value.timestamp ?? value.createAt ?? value.create_at ?? value.msgTime ?? value.msg_time),
            messageId: stringValue(value.messageId) ?? stringValue(value.msgId) ?? stringValue(value.id),
        };
    }).filter((entry) => entry.body.trim());
    return history.length ? history.slice(-limit) : undefined;
}
function ensureYachHistoryCapacity(historyMap, historyKey) {
    if (historyMap.has(historyKey) || historyMap.size < MAX_YACH_HISTORY_KEYS)
        return;
    const oldestKey = historyMap.keys().next().value;
    if (typeof oldestKey === "string")
        historyMap.delete(oldestKey);
}
function historyEntryKey(entry) {
    if (entry.messageId?.trim())
        return `message:${entry.messageId.trim()}`;
    return `content:${entry.sender}\u0000${entry.body}\u0000${entry.timestamp ?? ""}`;
}
function mergeHistoryEntries(providerHistory, pendingHistory, limit) {
    if (limit <= 0)
        return undefined;
    const merged = [];
    const seen = new Set();
    for (const entry of [...(providerHistory ?? []), ...(pendingHistory ?? [])]) {
        const key = historyEntryKey(entry);
        if (seen.has(key))
            continue;
        seen.add(key);
        merged.push(entry);
    }
    // The provider callback and the connection-owned pending window are two
    // independent streams. Do not let callback order decide which message is
    // "recent"; that is how a fresh pending message can be hidden behind stale
    // platform history. Stable sort preserves arrival order for equal timestamps.
    merged.sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0));
    return merged.length ? merged.slice(-limit) : undefined;
}
function inboundMediaFacts(message, messageId) {
    const url = stringValue(message.content);
    if (!url)
        return [];
    const kind = message.msgtype === "image" || message.msgtype === "audio" || message.msgtype === "video"
        ? message.msgtype
        : "document";
    const contentType = kind === "image" ? "image/*" : kind === "audio" ? "audio/*" : kind === "video" ? "video/*" : "application/octet-stream";
    return toInboundMediaFacts([{ url, contentType, kind, messageId }]);
}
function deliveryReceipt(results, kind, replyToId, content) {
    const receipt = createMessageReceiptFromOutboundResults({
        results: results,
        kind,
        replyToId,
        sentAt: Date.now(),
    });
    return {
        messageIds: receipt.platformMessageIds,
        receipt,
        visibleReplySent: receipt.platformMessageIds.length > 0,
        replyToId,
        ...(content ? { content } : {}),
    };
}
async function readPairingAllowFrom(runtime, account) {
    try {
        const entries = await runtime.channel.pairing.readAllowFromStore({
            channel: "yach-im-full",
            accountId: account.accountId,
        });
        return entries.map(String).map((entry) => entry.trim()).filter(Boolean);
    }
    catch {
        return null;
    }
}
async function isAllowed(runtime, senderId, conversationId, isGroup, account) {
    if (isGroup) {
        const room = resolveYachGroupRoomAccess(account, conversationId);
        if (!room.allowed)
            return room;
        const responseSettings = resolveYachGroupResponseSettings(account.config, conversationId);
        if (!isYachSenderAllowed(senderId, responseSettings.senderAllowFrom)) {
            return { allowed: false, reason: "group-sender-allowlist-unauthorized" };
        }
        if (responseSettings.pairedOnly) {
            const storeAllowFrom = await readPairingAllowFrom(runtime, account);
            if (!storeAllowFrom)
                return { allowed: false, reason: "group-pairing-store-unavailable" };
            if (!isYachSenderAllowed(senderId, storeAllowFrom)) {
                return { allowed: false, reason: "group-pairing-unauthorized" };
            }
        }
        return { allowed: true, reason: "allowed" };
    }
    if (account.dmPolicy === "disabled")
        return { allowed: false, reason: "dm-policy-disabled" };
    if (account.dmPolicy === "open")
        return { allowed: true, reason: "allowed" };
    if (account.allowFrom.includes("*") || account.allowFrom.includes(senderId)) {
        return { allowed: true, reason: "allowed" };
    }
    // TG's pairing store is a DM authorization source only. In particular,
    // dmPolicy=allowlist must not silently inherit previous pairing approvals.
    if (account.dmPolicy === "pairing") {
        const storeAllowFrom = await readPairingAllowFrom(runtime, account);
        if (storeAllowFrom && isYachSenderAllowed(senderId, storeAllowFrom)) {
            return { allowed: true, reason: "allowed" };
        }
    }
    return { allowed: false, reason: "dm-sender-unauthorized" };
}
async function requestPairing(runtime, account, senderId, senderDisplayName, logger) {
    if (account.dmPolicy !== "pairing")
        return;
    const pairing = runtime.channel.pairing;
    const result = await pairing.upsertPairingRequest({
        channel: "yach-im-full",
        accountId: account.accountId,
        id: senderId,
        meta: { name: senderDisplayName },
    }).catch(() => ({ code: "", created: false }));
    if (!result.created)
        return;
    logger.info(`[yach-im-full][${account.accountId}] pairing request from ${senderId}`);
    const reply = pairing.buildPairingReply({
        channel: "yach-im-full",
        idLine: `Your Yach IM user id: ${senderId}`,
        code: result.code,
    });
    await YachClient.fromAccount(account).im.sendMessage({
        toId: senderId,
        conversationType: "1",
        payload: { msgtype: "text", text: { content: reply } },
    }).catch((error) => logger.error(`[yach-im-full][${account.accountId}] pairing reply failed: ${String(error)}`));
}
async function dispatchOneMessage(params) {
    const { message, account, cfg, logger, historyMap } = params;
    const runtime = getYachRuntime();
    const msgtype = message.msgtype;
    if (!msgtype || !HANDLED_MESSAGE_TYPES.has(msgtype))
        return;
    if (!account.configured || !account.appKey || !account.appSecret) {
        logger.error(`[yach-im-full][${account.accountId}] account credentials are not configured`);
        return;
    }
    if (isMessageExpired(message.createAt))
        return;
    let senderId;
    let conversationId;
    let messageId;
    let chatbotUserId;
    try {
        senderId = decryptRequired(message.senderId, account.appKey, "senderId");
        conversationId = decryptOptional(message.conversationId, account.appKey) ?? senderId;
        messageId = decryptOptional(message.msgId, account.appKey) ?? message.msgIdClient ?? `${conversationId}:${message.createAt ?? Date.now()}`;
        chatbotUserId = decryptOptionalBestEffort(message.chatbotUserId, account.appKey);
        if (msgtype === "file" && stringValue(message.content)) {
            message.content = aesDecrypt(message.content, account.appKey);
        }
    }
    catch (error) {
        logger.error(`[yach-im-full][${account.accountId}] decrypt failed: ${String(error)}`);
        return;
    }
    if (!getMessageDedup(account.accountId).tryRecord(messageId, account.accountId)) {
        logger.info(`[yach-im-full][${account.accountId}] duplicate message dropped`);
        return;
    }
    const isGroup = String(message.conversationType) === "2";
    const identity = senderName(message, senderId);
    const originalBody = messageBody(message);
    const botFacts = resolveYachBotFacts(message, senderId, [chatbotUserId, account.botId]);
    const mentionFacts = resolveYachMentionFacts({
        text: originalBody,
        message,
        botId: chatbotUserId ?? account.botId,
        botName: stringValue(message.chatbotUserName),
    });
    const groupResponseSettings = isGroup
        ? resolveYachGroupResponseSettings(account.config, conversationId)
        : undefined;
    if (botFacts.isSelf) {
        logger.info(`[yach-im-full][${account.accountId}] message rejected: self-authored sender=${senderId}`);
        return;
    }
    const accessDecision = await isAllowed(runtime, senderId, conversationId, isGroup, account);
    if (!accessDecision.allowed) {
        if (!isGroup && account.dmPolicy === "pairing")
            await requestPairing(runtime, account, senderId, identity.name, logger);
        logger.info(`[yach-im-full][${account.accountId}] message rejected by channel policy reason=${accessDecision.reason}`);
        return;
    }
    const allowBots = groupResponseSettings?.allowBots ?? account.config.allowBots ?? false;
    if (botFacts.isBot && allowBots === false) {
        logger.info(`[yach-im-full][${account.accountId}] message rejected: bot sender not allowed sources=${botFacts.sources.join(",") || "unknown"}`);
        return;
    }
    if (botFacts.isBot && allowBots === "mentions" && isGroup && !mentionFacts.wasMentioned) {
        logger.info(`[yach-im-full][${account.accountId}] message rejected: bot sender was not mentioned`);
        return;
    }
    const rawBody = isGroup
        ? stripYachBotMention(originalBody, {
            botId: chatbotUserId ?? account.botId,
            botName: stringValue(message.chatbotUserName),
        })
        : originalBody;
    const to = isGroup ? `group:${conversationId}` : `user:${senderId}`;
    const peer = { kind: isGroup ? "group" : "direct", id: isGroup ? conversationId : senderId };
    const route = runtime.channel.routing.resolveAgentRoute({
        cfg,
        channel: "yach-im-full",
        accountId: account.accountId,
        peer,
    });
    const commandAuth = await resolveSenderCommandAuthorization({
        cfg,
        rawBody,
        isGroup,
        dmPolicy: account.dmPolicy,
        configuredAllowFrom: account.dmPolicy === "open" ? ["*", senderId] : account.allowFrom,
        configuredGroupAllowFrom: ["*"],
        senderId,
        channel: "yach-im-full",
        accountId: account.accountId,
        isSenderAllowed: (id, allowFrom) => isNormalizedSenderAllowed({ senderId: id, allowFrom }),
        readAllowFromStore: () => account.dmPolicy === "pairing"
            ? runtime.channel.pairing.readAllowFromStore({ channel: "yach-im-full", accountId: account.accountId }).catch(() => [])
            : Promise.resolve([]),
        shouldComputeCommandAuthorized: runtime.channel.commands.shouldComputeCommandAuthorized,
        resolveCommandAuthorizedFromAuthorizers: runtime.channel.commands.resolveCommandAuthorizedFromAuthorizers,
    });
    if (commandAuth.commandAuthorized === false)
        return;
    const mentionDecision = resolveInboundMentionDecision({
        facts: {
            canDetectMention: mentionFacts.canDetectMention,
            wasMentioned: mentionFacts.wasMentioned,
            hasAnyMention: mentionFacts.hasAnyMention,
            implicitMentionKinds: mentionFacts.implicitMentionKinds,
        },
        policy: {
            isGroup,
            requireMention: groupResponseSettings?.requireMention ?? true,
            // Yach IM's default group contract is strict: a group message must address
            // this bot before it may start an agent turn. In particular, do not let
            // a slash command bypass the @ gate, otherwise an unmentioned /models
            // would violate the documented "receive all, answer only when @" mode.
            allowTextCommands: false,
            hasControlCommand: hasControlCommand(rawBody, cfg),
            commandAuthorized: commandAuth.commandAuthorized ?? true,
        },
    });
    // Resolve the authoritative OpenClaw ingress record after the final agent
    // route is known. The legacy checks above are retained for their exact Yach
    // pairing/group behavior (including the pairing reply), but the exact
    // result entering buildContext must come from the shared ingress runtime.
    let channelIngress;
    try {
        const groupSenderAllowFrom = groupResponseSettings?.senderAllowFrom;
        channelIngress = await resolveStableChannelMessageIngress({
            channelId: "yach-im-full",
            accountId: account.accountId,
            identity: {
                key: "yach-user-id",
                kind: "stable-id",
                normalize: (value) => String(value).trim().replace(/^(?:yach-im-full|user):/i, "") || undefined,
                authentication: "asserted",
                sensitivity: "pii",
                entryIdPrefix: "yach-user",
                isWildcardEntry: (value) => String(value).trim() === "*",
                resolveParticipant: (subject) => subject.stableId == null
                    ? undefined
                    : { domain: "yach-im", idKind: "user-id", id: String(subject.stableId) },
            },
            subject: { stableId: senderId },
            conversation: {
                kind: isGroup ? "group" : "direct",
                id: conversationId,
            },
            contextBinding: {
                agentId: route.agentId,
                sessionKey: route.sessionKey,
                messageId,
                nativeChannelId: conversationId,
                inboundEventKind: "user_request",
            },
            event: { kind: "message", authMode: "inbound", mayPair: !isGroup },
            policy: {
                dmPolicy: account.dmPolicy,
                groupPolicy: account.groupPolicy,
                groupAllowFromFallbackToAllowFrom: false,
                activation: {
                    requireMention: isGroup ? Boolean(groupResponseSettings?.requireMention) : false,
                    allowTextCommands: false,
                },
            },
            allowFrom: account.allowFrom,
            // Yach's groupAllowFrom is a room allowlist and is represented by
            // the route gate above. The shared sender gate receives the raw
            // sender list; an allowed room with no sender restriction means
            // every sender in that room, represented by an explicit wildcard.
            groupAllowFrom: isGroup ? (groupSenderAllowFrom ?? ["*"]) : undefined,
            route: isGroup ? {
                id: `yach-im-full:group:${conversationId}`,
                kind: "route",
                configured: true,
                matched: true,
                allowed: true,
            } : undefined,
            mentionFacts: {
                canDetectMention: mentionFacts.canDetectMention,
                wasMentioned: mentionFacts.wasMentioned,
                hasAnyMention: mentionFacts.hasAnyMention,
                implicitMentionKinds: mentionFacts.implicitMentionKinds,
            },
            readStoreAllowFrom: async () => (await readPairingAllowFrom(runtime, account)) ?? [],
        });
    }
    catch (error) {
        // Never downgrade a failed authoritative access resolution to
        // `unsupported`; that would make an unknown authorization state enter
        // the host context. Fail closed and leave a bounded diagnostic.
        logger.error(`[yach-im-full][${account.accountId}] ingress resolution failed: ${String(error)}`);
        return;
    }
    if (!channelIngress?.senderAccess?.allowed) {
        logger.info(`[yach-im-full][${account.accountId}] message rejected by shared ingress policy reason=${channelIngress?.senderAccess?.reasonCode ?? "unknown"}`);
        return;
    }
    // Keep mention gating in the shared channel-turn preflight below. That lets
    // OpenClaw record an unmentioned group message in its pending history while
    // still preventing an agent turn. Returning here would make the message
    // disappear before the next @ message could use it as context.
    const shouldSuppressReply = Boolean(isGroup
        && groupResponseSettings?.requireMention
        // The long-link provider contract is known to deliver the complete
        // group stream. Therefore a missing positive @ decision is a real
        // non-dispatch, even if a malformed callback omitted bot identity
        // metadata. This is stricter than OpenClaw's generic "can't detect"
        // fallback and prevents accidental replies in the default mode.
        && (mentionDecision.shouldSkip || !mentionFacts.wasMentioned));
    const timestamp = timestampMs(message.createAt);
    let botLoopProtection;
    const receiverId = chatbotUserId ?? account.botId;
    if (botFacts.isBot && !botFacts.isSelf && receiverId && allowBots !== false) {
        const defaultsConfig = cfg.channels?.defaults?.botLoopProtection;
        const loopFacts = {
            scopeId: `yach-im-full:${account.accountId}`,
            conversationId,
            senderId,
            receiverId,
            eventId: messageId,
            config: account.config.botLoopProtection,
            defaultsConfig,
            defaultEnabled: true,
            nowMs: timestamp,
        };
        // The shared turn kernel records this exactly once after resolveTurn.
        // Keeping the facts on the assembled turn also lets OpenClaw emit its
        // standard admission/drop diagnostics instead of a provider-specific one.
        botLoopProtection = loopFacts;
    }
    const messageBodyWithSender = `${identity.name}: ${rawBody}`;
    const envelope = runtime.channel.reply.formatAgentEnvelope({
        channel: "Yach IM",
        from: isGroup ? `${conversationId}:${senderId}` : senderId,
        timestamp: new Date(timestamp),
        envelope: runtime.channel.reply.resolveEnvelopeFormatOptions(cfg),
        body: messageBodyWithSender,
    });
    const wasMentioned = mentionFacts.wasMentioned;
    const chatHistoryEnabled = account.config.chatHistoryEnabled !== false;
    const configuredHistoryLimit = account.config.chatHistoryLimit;
    const historyLimit = chatHistoryEnabled
        ? typeof configuredHistoryLimit === "number" && Number.isFinite(configuredHistoryLimit)
            ? Math.max(0, Math.floor(configuredHistoryLimit))
            : 20
        : 0;
    const pendingHistoryPlan = isGroup && historyLimit > 0
        ? {
            isGroup: true,
            historyKey: conversationId,
            historyMap,
            limit: historyLimit,
        }
        : undefined;
    if (pendingHistoryPlan)
        ensureYachHistoryCapacity(historyMap, conversationId);
    const pendingHistory = pendingHistoryPlan
        ? createChannelHistoryWindow({ historyMap }).buildInboundHistory({
            historyKey: conversationId,
            limit: historyLimit,
        })
        : undefined;
    const providerHistory = chatHistoryEnabled ? parseHistory(message, historyLimit) : undefined;
    const history = mergeHistoryEntries(providerHistory, pendingHistory, historyLimit);
    const bodyForAgent = rawBody;
    const media = ["image", "audio", "video", "file"].includes(msgtype)
        ? inboundMediaFacts(message, messageId)
        : [];
    const sourceModality = msgtype === "file" ? "document" : msgtype === "audio" ? "audio" : msgtype === "image" || msgtype === "video" ? msgtype : undefined;
    const incomingQuoteId = stringValue(message.replyMsgId) ?? stringValue(message.quoteMsgId);
    // msgIdClient is the provider-native message id used by Yach IM quote_msg_id;
    // msgId may be the encrypted SDK id and is not safe as a quote target.
    const sourceReplyToId = stringValue(message.quoteMsgId) ?? stringValue(message.msgIdClient);
    const ctxPayload = runtime.channel.inbound.buildContext({
        channel: "yach-im-full",
        provider: "yach-im-full",
        surface: "yach-im-full",
        accountId: route.accountId ?? account.accountId,
        messageId,
        messageIdFull: messageId,
        timestamp,
        from: isGroup ? `yach-im-full:group:${conversationId}` : `yach-im-full:${senderId}`,
        sender: {
            id: senderId,
            name: identity.name,
            tag: identity.tag,
            isBot: botFacts.isBot,
            isSelf: botFacts.isSelf,
        },
        conversation: {
            kind: isGroup ? "group" : "direct",
            id: isGroup ? conversationId : senderId,
            label: isGroup ? `Yach IM group ${conversationId}` : identity.name,
            nativeChannelId: isGroup ? conversationId : senderId,
            routePeer: peer,
        },
        route: {
            agentId: route.agentId,
            dmScope: route.dmScope,
            accountId: route.accountId ?? account.accountId,
            routeSessionKey: route.sessionKey,
            dispatchSessionKey: route.sessionKey,
        },
        reply: {
            to,
            originatingTo: to,
            replyToId: sourceReplyToId,
            replyToIdFull: sourceReplyToId,
            nativeChannelId: isGroup ? conversationId : senderId,
            sourceReplyDeliveryMode: sourceReplyToId ? "reply" : "direct",
        },
        message: {
            body: envelope,
            rawBody,
            bodyForAgent,
            commandBody: rawBody,
            inboundHistory: history,
            sourceModality,
        },
        sessionTranscript: {
            historyLimit,
        },
        access: {
            commands: { authorized: commandAuth.commandAuthorized ?? true },
            mentions: isGroup ? {
                canDetectMention: mentionFacts.canDetectMention,
                wasMentioned,
                hasAnyMention: mentionFacts.hasAnyMention,
                explicitlyMentionedBot: mentionFacts.explicitlyMentionedBot,
                mentionedUserIds: mentionFacts.mentionedUserIds,
                mentionSource: mentionFacts.mentionSource === "reply"
                    ? "implicit_thread"
                    : mentionFacts.explicitlyMentionedBot
                        ? "explicit_bot"
                        : mentionFacts.mentionSource
                            ? "mention_pattern"
                            : undefined,
                implicitMentionKinds: mentionFacts.implicitMentionKinds,
                requireMention: groupResponseSettings?.requireMention,
                effectiveWasMentioned: mentionDecision.effectiveWasMentioned,
            } : undefined,
        },
        media,
        channelIngress,
        supplemental: message.replyContent ? {
            quote: {
                id: incomingQuoteId,
                body: message.replyContent,
                senderAllowed: true,
            },
        } : undefined,
        channelContext: {
            sender: { id: senderId, name: identity.name, isBot: botFacts.isBot, isSelf: botFacts.isSelf },
            chat: { id: isGroup ? conversationId : senderId, kind: isGroup ? "group" : "direct" },
        },
        extra: {
            ChatType: isGroup ? "group" : "direct",
            GroupSubject: isGroup ? conversationId : undefined,
            WasMentioned: mentionDecision.effectiveWasMentioned,
            ExplicitlyMentionedBot: mentionFacts.explicitlyMentionedBot,
            SenderIsBot: botFacts.isBot,
            SenderIsSelf: botFacts.isSelf,
            GroupResponseMode: groupResponseSettings?.mode,
            GroupRequireMention: groupResponseSettings?.requireMention,
            GroupAllowBots: groupResponseSettings?.allowBots,
            CommandAuthorized: commandAuth.commandAuthorized ?? true,
            ReplyToBody: message.replyContent,
            OwnerAllowFrom: isGroup ? [] : [senderId],
            ...mediaPayload(message),
        },
    });
    const client = YachClient.fromAccount(account);
    const target = resolveYachTarget(to);
    const expressionScene = resolveYachExpressionScene({ msgtype, rawBody, isGroup });
    const typingExpression = chooseYachTypingExpression({
        config: account.config,
        scene: expressionScene,
        scopeKey: `${account.accountId}:${target.toId}`,
    });
    const typingMessageId = stringValue(message.msgIdClient) ?? messageId;
    logger.info(`[yach-im-full][${account.accountId}] expression selected scene=${expressionScene} expression=${typingExpression || "disabled"} msg_id=${typingMessageId}`);
    const replyMode = account.config.replyMode ?? "stream";
    const stream = replyMode === "stream"
        ? new YachStreamingCard(client, (event) => logger.info(`[yach-im-full][${account.accountId}] ${event}`))
        : undefined;
    let typingActive = false;
    let typingQueue = Promise.resolve();
    const setTyping = (active) => {
        typingQueue = typingQueue.catch(() => undefined).then(async () => {
            if (active === typingActive || !typingExpression)
                return;
            const state = active ? "start" : "stop";
            logger.info(`[yach-im-full][${account.accountId}] expression ${state} expression=${typingExpression} msg_id=${typingMessageId}`);
            try {
                await client.expression.toggle({
                    sessionId: target.toId,
                    sessionType: target.conversationType,
                    msgId: typingMessageId,
                    expression: typingExpression,
                    fromUserId: senderId,
                    log: (event) => logger.info(`[yach-im-full][${account.accountId}] ${event}`),
                });
                typingActive = active;
            }
            catch (error) {
                logger.warn(`[yach-im-full][${account.accountId}] typing expression ${state} failed: ${String(error)}`);
            }
        }).catch((error) => {
            logger.warn(`[yach-im-full][${account.accountId}] typing expression queue failed: ${String(error)}`);
        });
        return typingQueue;
    };
    const typingCallbacks = createTypingCallbacks({
        start: () => setTyping(true),
        stop: () => setTyping(false),
        onStartError: (error) => logger.warn(`[yach-im-full][${account.accountId}] typing callback start failed: ${String(error)}`),
        onStopError: (error) => logger.warn(`[yach-im-full][${account.accountId}] typing callback stop failed: ${String(error)}`),
    });
    // Start immediately after admission. The core normally starts typing when
    // the agent run begins, but fast-path commands and tool-only turns can
    // otherwise reach delivery without that callback.
    void typingCallbacks.onReplyStart();
    let streamedSegmentText = "";
    let streamStarted = false;
    let streamFailed = false;
    let modelBrowseDetected = false;
    let streamUpdateQueue = Promise.resolve();
    const appendStreamText = (nextText) => {
        streamUpdateQueue = streamUpdateQueue.then(async () => {
            if (!stream || !nextText || streamFailed || modelBrowseDetected)
                return;
            // Model browser responses need their native fold links intact. Do not
            // start a streaming card for them; the final delivery will be a clickable
            // Markdown response instead.
            if (transformModelTextToFoldLinks(nextText)) {
                modelBrowseDetected = true;
                return;
            }
            if (!streamStarted) {
                try {
                    await stream.start(target.toId, target.conversationType, sourceReplyToId);
                }
                catch (error) {
                    streamFailed = true;
                    logger.warn(`[yach-im-full][${account.accountId}] streaming card unavailable; falling back to text: ${String(error)}`);
                    return;
                }
                streamStarted = true;
            }
            let delta;
            if (nextText.startsWith(streamedSegmentText)) {
                delta = nextText.slice(streamedSegmentText.length) || null;
            }
            else if (streamedSegmentText.startsWith(nextText)) {
                delta = null;
            }
            else {
                // A new assistant segment starts after a tool call. The card API is
                // append-only, so send the new segment as-is rather than dropping it.
                delta = nextText || null;
            }
            streamedSegmentText = nextText;
            if (delta)
                stream.push(delta);
        });
        return streamUpdateQueue;
    };
    try {
        const deliver = async (payload, info) => {
            void setTyping(true);
            const results = [];
            const mediaUrls = Array.from(new Set(payload.mediaUrls?.length
                ? payload.mediaUrls
                : [payload.mediaUrl, ...(payload.attachments ?? []).map((attachment) => attachment.mediaUrl ?? attachment.url ?? attachment.path)].filter((value) => Boolean(value))));
            const rawText = payload.text?.trim() ? payload.text : payload.fallbackText?.text ?? "";
            const foldedText = rawText ? transformModelTextToFoldLinks(rawText) : null;
            // If partial streaming has already started, keep the card's text
            // coherent. In the normal `/models` path no partial card is started and
            // the complete response uses folded clickable links.
            const text = foldedText && !streamStarted ? foldedText : rawText;
            try {
                for (const mediaUrl of mediaUrls) {
                    const result = await yachOutbound.sendMedia?.({ cfg, to, text: "", mediaUrl, accountId: account.accountId, replyToId: payload.replyToId ?? sourceReplyToId });
                    if (result)
                        results.push(result);
                }
                if (stream && !streamFailed && !modelBrowseDetected && text.trim()) {
                    await appendStreamText(rawText);
                    if (streamStarted && !streamFailed && !modelBrowseDetected) {
                        const streamId = stream.getMessageId();
                        if (streamId)
                            results.push({ channel: "yach-im-full", messageId: streamId, target: { kind: target.conversationType === "2" ? "conversation" : "chat", id: target.toId }, });
                        if (info.kind === "final")
                            await stream.close();
                        return deliveryReceipt(results, "card", payload.replyToId ?? sourceReplyToId, text);
                    }
                }
                if (text.trim()) {
                    const chunks = chunkMarkdownTextWithMode(text, Math.max(1, account.config.textChunkLimit ?? 4_000), account.config.chunkMode ?? "length");
                    for (const chunk of chunks) {
                        const result = await yachOutbound.sendText?.({
                            cfg,
                            to,
                            text: chunk,
                            accountId: account.accountId,
                            replyToId: payload.replyToId ?? sourceReplyToId,
                        });
                        if (result)
                            results.push(result);
                    }
                }
                if (stream && info.kind === "final")
                    await stream.close();
                return deliveryReceipt(results, mediaUrls.length ? "media" : "text", payload.replyToId ?? sourceReplyToId, text);
            }
            catch (error) {
                const streamId = stream?.getMessageId();
                if (streamId && !results.some((result) => result.messageId === streamId)) {
                    results.push({ channel: "yach-im-full", messageId: streamId, target: { kind: target.conversationType === "2" ? "conversation" : "chat", id: target.toId } });
                }
                const partial = deliveryReceipt(results, stream ? "card" : mediaUrls.length ? "media" : "text", payload.replyToId ?? sourceReplyToId, text);
                if (partial.visibleReplySent) {
                    throw createChannelPartialDeliveryError(error, { ...partial, visibleReplySent: true });
                }
                throw error;
            }
        };
        await runtime.channel.inbound.run({
            channel: "yach-im-full",
            accountId: account.accountId,
            raw: message,
            log: (event) => logger.debug?.(`[yach-im-full][${account.accountId}] inbound ${event.stage}:${event.event}`),
            adapter: {
                ingest: () => ({
                    id: messageId,
                    timestamp,
                    rawText: rawBody,
                    textForAgent: bodyForAgent,
                    textForCommands: rawBody,
                    raw: message,
                }),
                preflight: () => {
                    if (!shouldSuppressReply)
                        return undefined;
                    if (pendingHistoryPlan)
                        ensureYachHistoryCapacity(historyMap, conversationId);
                    logger.info(`[yach-im-full][${account.accountId}] group message recorded in pending history; waiting for @ mention`);
                    return {
                        admission: {
                            kind: "drop",
                            reason: "missing-mention",
                            recordHistory: true,
                        },
                        message: {
                            senderLabel: identity.name,
                            bodyForAgent,
                            rawBody,
                        },
                        media,
                        history: pendingHistoryPlan
                            ? {
                                key: conversationId,
                                limit: historyLimit,
                                historyMap,
                                // Keep this explicit as well as admission.recordHistory.
                                // It documents the contract at the adapter boundary and
                                // protects the pending window if OpenClaw adds another drop
                                // admission path in a future host release.
                                recordOnDrop: true,
                            }
                            : undefined,
                    };
                },
                resolveTurn: () => ({
                    cfg,
                    channel: "yach-im-full",
                    accountId: account.accountId,
                    botLoopProtection,
                    route: {
                        agentId: route.agentId,
                        dmScope: route.dmScope,
                        sessionKey: route.sessionKey,
                        dispatchSessionKey: route.sessionKey,
                    },
                    ctxPayload,
                    record: {
                        updateLastRoute: {
                            sessionKey: route.sessionKey,
                            channel: "yach-im-full",
                            to,
                            accountId: route.accountId ?? account.accountId,
                        },
                        onRecordError: (error) => logger.warn(`[yach-im-full][${account.accountId}] session record failed: ${String(error)}`),
                    },
                    history: pendingHistoryPlan,
                    delivery: {
                        observeMessageSent: true,
                        deliver,
                        onError: (error) => logger.error(`[yach-im-full][${account.accountId}] reply failed: ${String(error)}`),
                    },
                    replyOptions: {
                        // Start the Yach IM reaction when the agent turn begins, so tool
                        // calls and slow model runs are visibly in progress too.
                        onReplyStart: () => typingCallbacks.onReplyStart(),
                        onTypingCleanup: () => typingCallbacks.onCleanup?.(),
                        // Native partial callbacks make the Yach IM card genuinely live;
                        // the final delivery remains responsible for closing it.
                        onPartialReply: (payload) => {
                            if (!payload.text)
                                return;
                            if (transformModelTextToFoldLinks(payload.text)) {
                                modelBrowseDetected = true;
                                return;
                            }
                            return appendStreamText(payload.text);
                        },
                    },
                }),
            },
        });
    }
    finally {
        // Cleanup is idempotent and also stops the keepalive loop from the shared
        // callback helper. The explicit await below drains the serialized Yach IM
        // toggle so the second call really removes the same expression.
        typingCallbacks.onCleanup?.();
        await setTyping(false);
        await typingQueue;
        await streamUpdateQueue.catch(() => undefined);
        if (stream)
            await stream.close();
    }
}
export async function handleInboundMessage(params) {
    const { message, account, cfg, logger } = params;
    const historyMap = params.historyMap ?? getFallbackHistoryMap(account.accountId);
    const msgtype = message.msgtype;
    logger.info(`[yach-im-full][${account.accountId}] received ${msgtype ?? "unknown"}`);
    const isGroup = String(message.conversationType) === "2";
    const senderId = typeof message.senderId === "string" ? message.senderId : "unknown";
    const conversationId = typeof message.conversationId === "string" ? message.conversationId : senderId;
    const chatId = isGroup ? `group:${conversationId}` : `user:${senderId}`;
    if (msgtype === "start_new_session") {
        // The normal dispatch path maps this provider-native event to /new.
    }
    if (msgtype === "abort") {
        logger.info(`[yach-im-full][${account.accountId}] abort event received for ${chatId}`);
        return;
    }
    if (msgtype && !HANDLED_MESSAGE_TYPES.has(msgtype))
        return;
    const task = () => dispatchOneMessage({ ...params, historyMap }).catch((error) => {
        logger.error(`[yach-im-full][${account.accountId}] inbound dispatch failed: ${String(error)}`);
    });
    const queued = enqueueChatTask({ accountId: account.accountId, chatId, task });
    if (queued.status === "queued")
        logger.info(`[yach-im-full][${account.accountId}] queued message for ${chatId}`);
    await queued.promise;
}
//# sourceMappingURL=inbound-dispatch.js.map
