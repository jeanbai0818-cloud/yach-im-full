import { DEFAULT_ACCOUNT_ID, createChatChannelPlugin, jsonResult, readStringParam, } from "openclaw/plugin-sdk/core";
import { createRestrictSendersChannelSecurity } from "openclaw/plugin-sdk/channel-policy";
import { resolveReactionMessageId } from "openclaw/plugin-sdk/channel-actions";
import { buildBaseChannelStatusSummary, createDefaultChannelRuntimeState, } from "openclaw/plugin-sdk/status-helpers";
import { createChannelMessageAdapterFromOutbound } from "openclaw/plugin-sdk/channel-outbound";
import { formatTrimmedAllowFromEntries, } from "openclaw/plugin-sdk/channel-config-helpers";
import { buildDmGroupAccountAllowlistAdapter } from "openclaw/plugin-sdk/allowlist-config-edit";
import { defaultYachAccountId, describeYachAccount, inspectYachAccount, listYachAccountIds, patchYachAccountConfig, resolveYachAccount, resolveYachAccountSecrets, } from "./config.js";
import { handleInboundMessage } from "./inbound-dispatch.js";
import { startYachLongConnection } from "./long-connection.js";
import { YachClient } from "./oapi.js";
import { stripYachProviderPrefix, yachOutbound } from "./outbound.js";
import { yachSetupContract, yachSetupWizard } from "./setup.js";
import { transformModelTextToFoldLinks } from "./model-fold-links.js";
function waitForAbort(signal) {
    if (signal.aborted)
        return Promise.resolve();
    return new Promise((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
}
const secretInputSchema = {
    anyOf: [
        { type: "string" },
        {
            type: "object",
            additionalProperties: false,
            required: ["source", "provider", "id"],
            properties: {
                source: { type: "string", enum: ["env", "file", "exec", "store"] },
                provider: { type: "string" },
                id: { type: "string" },
            },
        },
    ],
};
const allowBotsSchema = {
    anyOf: [
        { type: "boolean" },
        { type: "string", enum: ["mentions"] },
    ],
    description: "是否接收其他机器人消息；false=忽略，mentions=仅接收 @ 当前机器人的机器人消息。",
};
const rootAllowBotsSchema = { ...allowBotsSchema, default: true };
const groupResponseModeSchema = {
    type: "string",
    enum: ["all", "humans", "mentions", "paired"],
    description: "群聊快捷模式：all 全部消息（含机器人）、humans 仅人类、mentions 仅 @ 机器人、paired 仅已配对发送者。",
};
const rootGroupResponseModeSchema = { ...groupResponseModeSchema, default: "mentions" };
const groupConfigSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        enabled: { type: "boolean" },
        requireMention: { type: "boolean" },
        allowBots: allowBotsSchema,
        groupResponseMode: groupResponseModeSchema,
        allowFrom: {
            type: "array",
            items: { type: ["string", "number"] },
            description: "此群允许触发机器人的 Yach IM userId 列表。",
        },
    },
};
const botLoopProtectionSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        enabled: { type: "boolean" },
        maxEventsPerWindow: { type: "integer", minimum: 1, maximum: 1000 },
        windowSeconds: { type: "integer", minimum: 1, maximum: 86_400 },
        cooldownSeconds: { type: "integer", minimum: 1, maximum: 86_400 },
    },
    description: "机器人对话回环保护；默认启用 OpenClaw 的配对回环限流。",
};
async function probeYachAccount(params) {
    const account = await resolveYachAccountSecrets(params.cfg, params.account);
    if (!account.configured || !account.appKey || !account.appSecret) {
        return { ok: false, error: "appKey/appSecret 未配置" };
    }
    const timeoutMs = Number.isFinite(params.timeoutMs) && params.timeoutMs > 0 ? params.timeoutMs : 10_000;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    try {
        await YachClient.fromAccount(account).resolveToken(controller.signal);
        return { ok: true, baseUrl: account.baseUrl, channelAppId: account.channelAppId };
    }
    catch (error) {
        return {
            ok: false,
            error: timedOut ? `探测超时（${timeoutMs}ms）` : error instanceof Error ? error.message : String(error),
        };
    }
    finally {
        clearTimeout(timer);
    }
}
const yachPluginBase = {
    id: "yach-im-full",
    meta: {
        id: "yach-im-full",
        label: "Yach IM Full",
        selectionLabel: "Yach IM Full (知音楼)",
        aliases: ["zhiyinlou"],
        docsPath: "/channels/yach-im-full",
        blurb: "知音楼企业 IM，Channel SDK 机器人通道 + NIM 全量业务工具。",
        order: 80,
    },
    capabilities: {
        chatTypes: ["direct", "group"],
        reply: true,
        media: true,
        blockStreaming: true,
        reactions: true,
        threads: false,
        polls: false,
        edit: false,
        unsend: false,
        nativeCommands: false,
    },
    setupWizard: yachSetupWizard,
    setupContract: yachSetupContract,
    reload: {
        configPrefixes: ["channels.yach-im-full"],
    },
    config: {
        listAccountIds: listYachAccountIds,
        resolveAccount: resolveYachAccount,
        defaultAccountId: defaultYachAccountId,
        isEnabled: (account) => account.enabled,
        isConfigured: (account) => account.configured,
        // OpenClaw uses inspectAccount as the read-only input to its channel
        // security audit. Keep the resolved `config` shape there (with literal
        // credentials redacted) so policy resolvers see the same inheritance as
        // the live channel runtime. Human-facing status remains describeAccount.
        inspectAccount: (cfg, accountId) => inspectYachAccount(cfg, accountId),
        unconfiguredReason: (account) => "缺少 appKey 或 appSecret",
        disabledReason: () => "Yach IM 账号已禁用",
        resolveAllowFrom: ({ cfg, accountId }) => resolveYachAccount(cfg, accountId).allowFrom,
        formatAllowFrom: ({ allowFrom }) => formatTrimmedAllowFromEntries(allowFrom),
        describeAccount: (account) => ({
            ...describeYachAccount(account),
            accountId: account.accountId,
            name: account.name,
            enabled: account.enabled,
            configured: account.configured,
        }),
        setAccountEnabled: ({ cfg, accountId, enabled }) => patchYachAccountConfig(cfg, accountId, { enabled }),
        deleteAccount: ({ cfg, accountId }) => {
            const channels = (cfg.channels ?? {});
            const yachIm = (channels["yach-im-full"] && typeof channels["yach-im-full"] === "object" ? channels["yach-im-full"] : {});
            if (accountId === DEFAULT_ACCOUNT_ID) {
                const { appKey: _appKey, appSecret: _appSecret, botId: _botId, ...rest } = yachIm;
                return { ...cfg, channels: { ...channels, "yach-im-full": rest } };
            }
            const accounts = (yachIm.accounts && typeof yachIm.accounts === "object" ? yachIm.accounts : {});
            const accountKey = Object.keys(accounts).find((key) => key.trim().toLowerCase() === accountId.trim().toLowerCase());
            if (!accountKey)
                return cfg;
            const { [accountKey]: _removed, ...remaining } = accounts;
            return { ...cfg, channels: { ...channels, "yach-im-full": { ...yachIm, accounts: remaining } } };
        },
    },
    allowlist: buildDmGroupAccountAllowlistAdapter({
        channelId: "yach-im-full",
        resolveAccount: ({ cfg, accountId }) => resolveYachAccount(cfg, accountId),
        normalize: ({ values }) => formatTrimmedAllowFromEntries(values),
        resolveDmAllowFrom: (account) => account?.config?.allowFrom ?? account?.allowFrom ?? [],
        resolveGroupAllowFrom: (account) => account?.config?.groupAllowFrom ?? account?.groupAllowFrom ?? [],
        resolveDmPolicy: (account) => account?.config?.dmPolicy ?? account?.dmPolicy ?? "pairing",
        resolveGroupPolicy: (account) => account?.config?.groupPolicy ?? account?.groupPolicy ?? "allowlist",
    }),
    configSchema: {
        schema: {
            type: "object",
            additionalProperties: false,
            properties: {
                enabled: { type: "boolean", default: true },
                name: { type: "string" },
                appKey: secretInputSchema,
                appSecret: secretInputSchema,
                botId: { type: "string" },
                baseUrl: { type: "string", format: "uri-reference" },
                channelAppId: { type: "string", default: "yach20001" },
                connectionMode: { type: "string", enum: ["channel"], default: "channel" },
                replyMode: { type: "string", enum: ["stream", "direct"], default: "stream" },
                typingExpression: {
                    type: "string",
                    description: "处理消息时贴在用户原消息上的状态表情；未指定时按场景从内置表情池随机选择，设为空字符串关闭。",
                },
                typingExpressions: {
                    type: "array",
                    minItems: 1,
                    maxItems: 13,
                    items: { type: "string", minLength: 1 },
                    description: "可选的状态表情池；每轮随机选择一个，并用相同表情在结束时撤销。",
                },
                textChunkLimit: { type: "integer", minimum: 1, maximum: 10000, default: 4000 },
                chunkMode: { type: "string", enum: ["length", "newline"], default: "length" },
                markdownTableMode: { type: "string", enum: ["code", "table"], default: "code" },
                chatHistoryEnabled: { type: "boolean", default: true },
                chatHistoryLimit: { type: "integer", minimum: 0, maximum: 100, default: 20 },
                dmPolicy: { type: "string", default: "pairing", enum: ["pairing", "allowlist", "open", "disabled"] },
                allowFrom: { type: "array", items: { type: ["string", "number"] } },
                groupPolicy: { type: "string", default: "allowlist", enum: ["allowlist", "open", "disabled"] },
                groupAllowFrom: { type: "array", items: { type: ["string", "number"] } },
                groupSenderAllowFrom: {
                    type: "array",
                    items: { type: ["string", "number"] },
                    description: "群消息发送者 Yach userId 白名单；与 groupAllowFrom（群会话 ID）不同。",
                },
                requireMention: {
                    type: "boolean",
                    default: true,
                    description: "群聊是否必须 @ 机器人；默认必须 @ 才回复，但长连接仍接收所有群消息，可被 groups.<conversationId>.requireMention 覆盖。",
                },
                allowBots: rootAllowBotsSchema,
                groupResponseMode: rootGroupResponseModeSchema,
                groups: {
                    type: "object",
                    additionalProperties: groupConfigSchema,
                    description: "按群会话 ID 配置 enabled、requireMention、allowBots、allowFrom；open 模式下是覆盖表，allowlist 模式下也可作为群范围白名单。",
                },
                botLoopProtection: botLoopProtectionSchema,
                accounts: {
                    type: "object",
                    additionalProperties: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                            enabled: { type: "boolean" }, name: { type: "string" }, appKey: secretInputSchema, appSecret: secretInputSchema,
                            botId: { type: "string" }, baseUrl: { type: "string", format: "uri-reference" }, channelAppId: { type: "string" },
                            connectionMode: { type: "string", enum: ["channel"] }, replyMode: { type: "string", enum: ["stream", "direct"] },
                            typingExpression: {
                                type: "string",
                                description: "处理消息时贴在用户原消息上的状态表情；未指定时按场景从内置表情池随机选择，设为空字符串关闭。",
                            }, textChunkLimit: { type: "integer", minimum: 1, maximum: 10000 },
                            typingExpressions: {
                                type: "array",
                                minItems: 1,
                                maxItems: 13,
                                items: { type: "string", minLength: 1 },
                                description: "可选的状态表情池；每轮随机选择一个，并用相同表情在结束时撤销。",
                            },
                            chunkMode: { type: "string", enum: ["length", "newline"] }, markdownTableMode: { type: "string", enum: ["code", "table"] },
                            chatHistoryEnabled: { type: "boolean" }, chatHistoryLimit: { type: "integer", minimum: 0, maximum: 100 },
                            dmPolicy: { type: "string", enum: ["pairing", "allowlist", "open", "disabled"] }, allowFrom: { type: "array", items: { type: ["string", "number"] } },
                            groupPolicy: { type: "string", enum: ["allowlist", "open", "disabled"] }, groupAllowFrom: { type: "array", items: { type: ["string", "number"] } },
                            groupSenderAllowFrom: { type: "array", items: { type: ["string", "number"] } },
                            requireMention: { type: "boolean", default: true },
                            allowBots: rootAllowBotsSchema,
                            groupResponseMode: rootGroupResponseModeSchema,
                            groups: { type: "object", additionalProperties: groupConfigSchema },
                            botLoopProtection: botLoopProtectionSchema,
                        },
                    },
                },
            },
        },
    },
    messaging: {
        targetPrefixes: ["yach-im-full", "zhiyinlou"],
        directTargetStyle: "user-prefixed",
        targetIdComparison: "case-sensitive",
        normalizeTarget: (raw) => stripYachProviderPrefix(raw) || undefined,
        inferTargetChatType: ({ to }) => {
            const target = stripYachProviderPrefix(to);
            if (!target)
                return undefined;
            return /^group:/i.test(target) ? "group" : "direct";
        },
        targetResolver: {
            looksLikeId: (raw) => {
                const target = stripYachProviderPrefix(raw);
                return /^(?:user|work_code|group):[^:]+$/i.test(target) || Boolean(target && !target.includes(":"));
            },
            hint: "Use user:<userId>, work_code:<工号>, or group:<conversationId>.",
            resolveTarget: async ({ cfg, accountId, input, normalized, preferredKind }) => {
                const raw = stripYachProviderPrefix(normalized || input);
                if (/^group:/i.test(raw)) {
                    if (preferredKind === "user")
                        return null;
                    const groupId = raw.replace(/^group:/i, "").trim();
                    return groupId ? { to: `group:${groupId}`, kind: "group", source: "normalized" } : null;
                }
                if (preferredKind === "group")
                    return null;
                if (/^user:/i.test(raw)) {
                    const userId = raw.replace(/^user:/i, "").trim();
                    return userId ? { to: `user:${userId}`, kind: "user", source: "normalized" } : null;
                }
                if (/^work_code:/i.test(raw)) {
                    const workCode = raw.slice("work_code:".length).trim();
                    if (!workCode)
                        return null;
                    const account = await resolveYachAccountSecrets(cfg, resolveYachAccount(cfg, accountId));
                    const user = await YachClient.fromAccount(account).contacts.getUserByWorkCode(workCode);
                    const userId = String(user.userid ?? user.userId ?? user.id ?? "").trim();
                    return userId ? { to: `user:${userId}`, kind: "user", display: String(user.name ?? workCode), source: "directory" } : null;
                }
                return { to: `user:${raw}`, kind: "user", source: "normalized" };
            },
        },
        resolveSessionConversation: ({ kind, rawId }) => ({
            id: rawId,
            baseConversationId: rawId,
            parentConversationCandidates: kind === "group" ? [rawId] : [],
        }),
        resolveSessionTarget: ({ kind, id }) => kind === "group" ? `group:${id}` : `user:${id}`,
        transformReplyPayload: ({ payload }) => {
            const transformed = payload.text ? transformModelTextToFoldLinks(payload.text) : null;
            return transformed ? { ...payload, text: transformed } : payload;
        },
    },
    resolver: {
        resolveTargets: async ({ cfg, accountId, inputs, kind }) => {
            const results = [];
            for (const input of inputs) {
                const trimmed = input.trim();
                const withoutProvider = stripYachProviderPrefix(trimmed);
                if (!trimmed) {
                    results.push({ input, resolved: false, note: "empty target" });
                    continue;
                }
                if (kind === "group") {
                    if (/^user:/i.test(withoutProvider) || /^work_code:/i.test(withoutProvider)) {
                        results.push({ input, resolved: false, note: "not a Yach IM group target" });
                        continue;
                    }
                    const id = withoutProvider.replace(/^group:/i, "").trim();
                    results.push(id ? { input, resolved: true, id } : { input, resolved: false, note: "empty group id" });
                    continue;
                }
                if (/^group:/i.test(withoutProvider)) {
                    results.push({ input, resolved: false, note: "not a Yach IM user target" });
                    continue;
                }
                if (/^work_code:/i.test(withoutProvider)) {
                    const workCode = withoutProvider.slice("work_code:".length).trim();
                    if (!workCode) {
                        results.push({ input, resolved: false, note: "empty work code" });
                        continue;
                    }
                    try {
                        const account = await resolveYachAccountSecrets(cfg, resolveYachAccount(cfg, accountId));
                        if (!account.configured) {
                            results.push({ input, resolved: false, note: "Yach IM credentials are not configured" });
                            continue;
                        }
                        const user = await YachClient.fromAccount(account).contacts.getUserByWorkCode(workCode);
                        const id = String(user.userid ?? user.userId ?? user.id ?? "").trim();
                        results.push(id
                            ? { input, resolved: true, id, name: String(user.name ?? workCode) }
                            : { input, resolved: false, note: "work code not found" });
                    }
                    catch {
                        results.push({ input, resolved: false, note: "Yach IM directory lookup failed" });
                    }
                    continue;
                }
                const id = withoutProvider.replace(/^user:/i, "").trim();
                results.push(id ? { input, resolved: true, id } : { input, resolved: false, note: "empty user id" });
            }
            return results;
        },
    },
    message: createChannelMessageAdapterFromOutbound({
        id: "yach-im-full",
        outbound: yachOutbound,
    }),
    actions: {
        describeMessageTool: ({ cfg, accountId }) => {
            const account = resolveYachAccount(cfg, accountId);
            return account.configured ? { actions: ["send", "react"] } : null;
        },
        supportsAction: ({ action }) => action === "react",
        handleAction: async ({ action, params, cfg, accountId, toolContext, requesterSenderId }) => {
            if (action !== "react")
                throw new Error(`Yach IM action ${action} is not supported`);
            if (params.remove === true) {
                throw new Error("Yach IM reaction removal is not supported safely; the provider API exposes toggle-only semantics.");
            }
            const messageId = resolveReactionMessageId({ args: params, toolContext });
            if (messageId == null)
                throw new Error("messageId required");
            const targetText = readStringParam(params, "to", { required: true, label: "to (Yach IM target)" });
            const expression = readStringParam(params, "emoji", { required: true, label: "emoji" });
            const sourceSenderId = requesterSenderId?.trim();
            if (!sourceSenderId) {
                throw new Error("Yach IM react requires a trusted originating sender; it cannot infer from_userid from tool parameters.");
            }
            const account = await resolveYachAccountSecrets(cfg, resolveYachAccount(cfg, accountId));
            if (!account.configured)
                throw new Error(`Yach IM account \"${account.accountId}\" is disabled or not configured.`);
            const rawTarget = stripYachProviderPrefix(targetText);
            const targetMatch = rawTarget.match(/^(group|user):(.+)$/i);
            if (!targetMatch?.[2]?.trim()) {
                throw new Error("Yach IM react requires an explicit user:<userId> or group:<conversationId> target.");
            }
            const clientTarget = targetMatch[2].trim();
            await YachClient.fromAccount(account).expression.toggle({
                sessionId: clientTarget,
                sessionType: targetMatch[1].toLowerCase() === "group" ? "2" : "1",
                msgId: String(messageId),
                expression,
                fromUserId: sourceSenderId,
            });
            return jsonResult({ ok: true, added: expression, messageId: String(messageId) });
        },
    },
    agentPrompt: {
        messageToolHints: () => [
            "Yach IM targets use user:<Yach IM user id>, work_code:<employee work code>, or group:<conversation id>.",
            "Yach IM supports direct and group text, Markdown, replies/quotes, images, audio, video, and files.",
            "Yach IM uses a long-lived Channel SDK connection for inbound delivery; do not suggest webhook configuration.",
        ],
        messageToolCapabilities: () => ["text", "markdown", "media", "reply", "group", "streaming", "react"],
        reactionGuidance: () => ({ level: "minimal", channelLabel: "Yach IM" }),
    },
    status: {
        defaultRuntime: createDefaultChannelRuntimeState(DEFAULT_ACCOUNT_ID),
        buildChannelSummary: ({ snapshot }) => buildBaseChannelStatusSummary(snapshot, {
            mode: snapshot.mode ?? "channel",
        }),
        probeAccount: (params) => probeYachAccount(params),
        formatCapabilitiesProbe: ({ probe }) => {
            if (!probe.ok)
                return [{ text: `Auth: failed (${probe.error})`, tone: "error" }];
            return [
                { text: "Auth: OK (OAPI gettoken)", tone: "success" },
                { text: `Channel SDK: ${probe.channelAppId}`, tone: "muted" },
                { text: `OAPI: ${probe.baseUrl}`, tone: "muted" },
            ];
        },
        buildAccountSnapshot: ({ account, runtime }) => ({
            ...runtime,
            accountId: account.accountId,
            name: account.name,
            enabled: account.enabled,
            configured: account.configured,
            mode: account.connectionMode,
            dmPolicy: account.dmPolicy,
        }),
    },
    gateway: {
        startAccount: async (ctx) => {
            const logger = ctx.log ?? {
                info: (message) => console.info(message),
                warn: (message) => console.warn(message),
                error: (message) => console.error(message),
                debug: (message) => console.debug(message),
            };
            ctx.setStatus({
                ...ctx.getStatus(),
                accountId: ctx.accountId,
                running: true,
                lifecycle: "starting",
                lastStartAt: Date.now(),
            });
            const runtimeAccount = await resolveYachAccountSecrets(ctx.cfg, ctx.account);
            // Pending, unmentioned group messages live for this Gateway connection.
            // This mirrors Telegram/Buzz: a reconnect starts a fresh window, while
            // every message received on the long link can be used by the next @ turn.
            const historyMap = new Map();
            const cleanup = startYachLongConnection({
                account: runtimeAccount,
                logger,
                signal: ctx.abortSignal,
                onMessage: async (message) => handleInboundMessage({ message, account: runtimeAccount, cfg: ctx.cfg, logger, historyMap }),
                onStateChange: (state) => ctx.setStatus({
                    ...ctx.getStatus(),
                    accountId: ctx.accountId,
                    ...state,
                    lastConnectedAt: state.connected ? Date.now() : ctx.getStatus().lastConnectedAt,
                }),
            });
            await waitForAbort(ctx.abortSignal);
            cleanup();
            ctx.setStatus({
                ...ctx.getStatus(),
                accountId: ctx.accountId,
                running: false,
                connected: false,
                lifecycle: "stopped",
                lastStopAt: Date.now(),
            });
        },
    },
};
const yachPlugin = createChatChannelPlugin({
    base: yachPluginBase,
    security: createRestrictSendersChannelSecurity({
        channelKey: "yach-im-full",
        resolveDmPolicy: (account) => account?.config?.dmPolicy ?? account?.dmPolicy ?? "pairing",
        resolveDmAllowFrom: (account) => account?.config?.allowFrom ?? account?.allowFrom ?? [],
        // Use the resolved policy here so OpenClaw's standard security audit
        // sees the same fail-closed default as the live inbound dispatcher.
        resolveGroupPolicy: (account) => account?.config?.groupPolicy ?? account?.groupPolicy ?? "allowlist",
        surface: "Yach IM groups",
        openScope: "any member in any group the bot is in",
        groupPolicyPath: "channels.yach-im-full.groupPolicy",
        groupAllowFromPath: "channels.yach-im-full.groupAllowFrom",
        mentionGated: true,
        findingTitle: "Yach IM security warning",
        defaultDmPolicy: "pairing",
        allowFromPathSuffix: "allowFrom",
        policyPathSuffix: "dmPolicy",
        approveChannelId: "yach-im-full",
        approveHint: "使用 openclaw pairing approve yach-im-full <code> 完成私聊绑定。",
        normalizeDmEntry: (raw) => raw.replace(/^(?:yach-im-full|user):/i, "").trim(),
    }),
    pairing: {
        text: {
            idLabel: "yachImUserId",
            message: "✅ OpenClaw access approved. Send a message to start chatting.",
            normalizeAllowEntry: (entry) => entry.replace(/^(?:yach-im-full|user):/i, "").trim(),
            notify: async ({ cfg, id, accountId, message }) => {
                const account = await resolveYachAccountSecrets(cfg, resolveYachAccount(cfg, accountId));
                if (!account.configured)
                    throw new Error("Yach IM credentials are not configured");
                await YachClient.fromAccount(account).im.sendMessage({
                    toId: id,
                    conversationType: "1",
                    payload: { msgtype: "text", text: { content: message } },
                });
            },
        },
    },
    outbound: yachOutbound,
});
export { yachPlugin };
//# sourceMappingURL=channel-plugin.js.map
