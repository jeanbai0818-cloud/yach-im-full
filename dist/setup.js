import { createAllowFromSection, createStandardChannelSetupStatus, defineTokenCredential, normalizeAccountId, setSetupChannelEnabled, splitSetupEntries, } from "openclaw/plugin-sdk/setup";
import { defineChannelSetupContract, } from "openclaw/plugin-sdk/channel-setup";
import { hasConfiguredSecretInput } from "openclaw/plugin-sdk/secret-input-runtime";
import { defaultYachAccountId, listYachAccountIds, patchYachAccountConfig, resolveYachAccount, } from "./config.js";
import { YACH_GROUP_RESPONSE_MODES, normalizeYachGroupResponseMode } from "./group-response.js";
const CHANNEL = "yach-im-full";
const DEFAULT_ACCOUNT = "default";
const APP_KEY_ENV = "YACH_IM_APP_KEY";
const APP_SECRET_ENV = "YACH_IM_APP_SECRET";
function resolveAccount(params) {
    return resolveYachAccount(params.cfg, params.accountId);
}
function accountPatch(cfg, accountId, patch) {
    return patchYachAccountConfig(cfg, accountId, { enabled: true, ...patch });
}
function stringValue(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function normalizeAllowEntry(raw) {
    return raw.trim().replace(/^(?:yach-im-full|user):/i, "");
}
function parseAllowId(raw) {
    const value = normalizeAllowEntry(raw);
    return value || null;
}
function resolveAllowEntries(entries) {
    return entries.map((input) => {
        const id = parseAllowId(input);
        return { input, resolved: Boolean(id), id };
    });
}
function dmPolicyFor(cfg, accountId) {
    return resolveYachAccount(cfg, accountId).dmPolicy;
}
function groupPolicyFor(cfg, accountId) {
    return resolveYachAccount(cfg, accountId).groupPolicy;
}
function allowFromFor(cfg, accountId) {
    return resolveYachAccount(cfg, accountId).allowFrom;
}
function groupAllowFromFor(cfg, accountId) {
    return resolveYachAccount(cfg, accountId).groupAllowFrom;
}
const yachSetupAdapter = {
    resolveAccountId: ({ accountId }) => normalizeAccountId(accountId),
    validateInput: ({ accountId, input }) => {
        if (input.useEnv && accountId !== DEFAULT_ACCOUNT) {
            return `${APP_KEY_ENV} and ${APP_SECRET_ENV} can only be used for the default account.`;
        }
        if (!input.useEnv && (!stringValue(input.appKey) || !stringValue(input.appSecret))) {
            return "Yach IM requires --app-key and --app-secret (or --use-env).";
        }
        if (input.groupResponseMode && !normalizeYachGroupResponseMode(input.groupResponseMode)) {
            return `Yach IM group response mode must be one of: ${YACH_GROUP_RESPONSE_MODES.join(", ")}.`;
        }
        return null;
    },
    applyAccountConfig: ({ cfg, accountId, input }) => {
        const current = resolveYachAccount(cfg, accountId).config;
        const patch = { enabled: true };
        if (input.useEnv) {
            patch.appKey = { source: "env", provider: "default", id: APP_KEY_ENV };
            patch.appSecret = { source: "env", provider: "default", id: APP_SECRET_ENV };
        }
        else {
            patch.appKey = stringValue(input.appKey);
            patch.appSecret = stringValue(input.appSecret);
        }
        const botId = stringValue(input.botId);
        if (botId)
            patch.botId = botId;
        const name = stringValue(input.name);
        if (name)
            patch.name = name;
        const groupResponseMode = normalizeYachGroupResponseMode(input.groupResponseMode);
        if (groupResponseMode)
            patch.groupResponseMode = groupResponseMode;
        // Persist the fail-closed OpenClaw default during setup so `channels add`
        // produces a self-explanatory config. Preserve an existing explicit
        // policy when the wizard is rerun for credentials or another field.
        if (current.groupPolicy === undefined)
            patch.groupPolicy = "allowlist";
        const effectiveMode = groupResponseMode
            ?? normalizeYachGroupResponseMode(current.groupResponseMode)
            ?? "mentions";
        if (current.groupResponseMode === undefined && !groupResponseMode)
            patch.groupResponseMode = "mentions";
        if (current.requireMention === undefined && effectiveMode === "mentions")
            patch.requireMention = true;
        if (current.allowBots === undefined && effectiveMode === "mentions")
            patch.allowBots = true;
        if (current.connectionMode === undefined)
            patch.connectionMode = "channel";
        if (current.chatHistoryEnabled === undefined)
            patch.chatHistoryEnabled = true;
        if (current.chatHistoryLimit === undefined)
            patch.chatHistoryLimit = 20;
        return patchYachAccountConfig(cfg, accountId, patch);
    },
    singleAccountKeysToMove: [
        "appKey",
        "appSecret",
        "botId",
        "baseUrl",
        "channelAppId",
        "connectionMode",
        "replyMode",
        "typingExpression",
        "typingExpressions",
        "textChunkLimit",
        "chunkMode",
        "markdownTableMode",
        "chatHistoryEnabled",
        "chatHistoryLimit",
        "groupPolicy",
        "groupAllowFrom",
        "requireMention",
        "allowBots",
        "groupResponseMode",
        "groupSenderAllowFrom",
        "groups",
        "botLoopProtection",
    ],
    namedAccountPromotionKeys: [
        "appKey",
        "appSecret",
        "botId",
        "baseUrl",
        "channelAppId",
        "connectionMode",
        "replyMode",
        "typingExpression",
        "typingExpressions",
        "textChunkLimit",
        "chunkMode",
        "markdownTableMode",
        "chatHistoryEnabled",
        "chatHistoryLimit",
        "groupPolicy",
        "groupAllowFrom",
        "requireMention",
        "allowBots",
        "groupResponseMode",
        "groupSenderAllowFrom",
        "groups",
        "botLoopProtection",
    ],
};
export const yachSetupContract = defineChannelSetupContract({
    fields: {
        appKey: {
            kind: "string",
            sensitive: true,
            cli: {
                flags: "--app-key <appKey>",
                description: "Yach IM appKey",
            },
        },
        appSecret: {
            kind: "string",
            sensitive: true,
            cli: {
                flags: "--app-secret <appSecret>",
                description: "Yach IM appSecret",
            },
        },
        botId: {
            kind: "string",
            cli: {
                flags: "--bot-id <botId>",
                description: "Optional Yach IM botId",
            },
        },
        groupResponseMode: {
            kind: "choice",
            choices: ["all", "humans", "mentions", "paired"],
            cli: {
                flags: "--group-response-mode <mode>",
                description: "Yach IM group response mode",
            },
        },
        useEnv: {
            kind: "boolean",
            cli: {
                flags: "--use-env",
                description: `Use ${APP_KEY_ENV} and ${APP_SECRET_ENV}`,
            },
            envVars: [APP_KEY_ENV, APP_SECRET_ENV],
            envVarMode: "all",
        },
    },
    adapter: yachSetupAdapter,
});
function makeCredential(params) {
    return defineTokenCredential({
        inputKey: params.inputKey,
        configKey: params.inputKey,
        providerHint: CHANNEL,
        credentialLabel: params.label,
        preferredEnvVar: params.envVar,
        helpTitle: `Yach IM ${params.label}`,
        helpLines: [
            "使用知音楼机器人应用的凭据。Yach IM 接收消息走 Channel SDK 长连接，不需要 webhook 地址。",
            `默认账号可使用环境变量 ${params.envVar}，多账号请在向导中分别录入凭据。`,
        ],
        envPrompt: `使用环境变量 ${params.envVar}？`,
        keepPrompt: `保留当前 Yach IM ${params.label}？`,
        inputPrompt: `请输入 Yach IM ${params.label}：`,
        allowEnv: ({ accountId }) => accountId === DEFAULT_ACCOUNT,
        resolveAccount,
        hasConfiguredValue: (account) => hasConfiguredSecretInput(account.config[params.inputKey]),
        resolvedValue: (account) => account[params.inputKey],
        envValue: ({ accountId }) => accountId === DEFAULT_ACCOUNT ? stringValue(process.env[params.envVar]) : undefined,
        patchAccount: ({ cfg, accountId, patch }) => accountPatch(cfg, accountId, patch),
        useEnv: {
            patch: () => ({
                [params.inputKey]: { source: "env", provider: "default", id: params.envVar },
            }),
        },
        set: { value: "input" },
    });
}
const yachDmPolicy = {
    label: "Yach IM",
    channel: CHANNEL,
    policyKey: "dmPolicy",
    allowFromKey: "allowFrom",
    getCurrent: (cfg, accountId) => dmPolicyFor(cfg, accountId ?? defaultYachAccountId(cfg)),
    setPolicy: (cfg, policy, accountId) => patchYachAccountConfig(cfg, accountId ?? defaultYachAccountId(cfg), {
        dmPolicy: policy,
    }),
};
const yachAllowFrom = createAllowFromSection({
    helpTitle: "Yach IM 私聊访问控制",
    helpLines: [
        "默认使用 pairing：未允许的用户会收到配对请求。",
        "也可以填写 Yach IM userId 列表改用 allowlist；不要填写姓名或工号。",
    ],
    message: "允许哪些 Yach IM userId？",
    placeholder: "yachImUserId[, yachImUserId...]",
    invalidWithoutCredentialNote: "请输入有效的 Yach IM userId。",
    parseInputs: splitSetupEntries,
    parseId: parseAllowId,
    resolveEntries: async ({ entries }) => resolveAllowEntries(entries),
    apply: ({ cfg, accountId, allowFrom }) => accountPatch(cfg, accountId, {
        dmPolicy: "allowlist",
        allowFrom,
    }),
});
const yachGroupAccess = {
    label: "Yach IM 群聊",
    placeholder: "conversationId[, conversationId...]",
    helpTitle: "Yach IM 群聊访问控制",
    helpLines: [
        "默认是 allowlist：只有明确填写的群 conversationId 会进入处理范围。",
        "如果确实需要放开，可选择 open；也可以选择 disabled 关闭群聊。",
    ],
    currentPolicy: (params) => groupPolicyFor(params.cfg, params.accountId),
    currentEntries: (params) => groupAllowFromFor(params.cfg, params.accountId),
    updatePrompt: (params) => Boolean(resolveYachAccount(params.cfg, params.accountId).config.groupPolicy ||
        resolveYachAccount(params.cfg, params.accountId).config.groupAllowFrom),
    setPolicy: ({ cfg, accountId, policy }) => accountPatch(cfg, accountId, { groupPolicy: policy }),
    resolveAllowlist: async ({ entries }) => resolveAllowEntries(entries).map((entry) => entry.id).filter((id) => Boolean(id)),
    applyAllowlist: ({ cfg, accountId, resolved }) => accountPatch(cfg, accountId, {
        groupAllowFrom: Array.isArray(resolved) ? resolved.map(String).map((entry) => entry.trim()).filter(Boolean) : [],
    }),
};
export const yachSetupWizard = {
    channel: CHANNEL,
    status: createStandardChannelSetupStatus({
        channelLabel: "Yach IM",
        configuredLabel: "已配置",
        unconfiguredLabel: "需要 appKey 和 appSecret",
        configuredHint: "Yach IM 使用 Channel SDK 长连接接收聊天消息。",
        unconfiguredHint: "用向导录入机器人凭据即可，不需要手动写 webhook 配置。",
        configuredScore: 1,
        unconfiguredScore: 10,
        resolveConfigured: ({ cfg, accountId }) => {
            if (accountId)
                return resolveYachAccount(cfg, accountId).configured;
            return listYachAccountIds(cfg).some((id) => resolveYachAccount(cfg, id).configured);
        },
        includeStatusLine: true,
    }),
    introNote: {
        title: "Yach IM 聊天通道",
        lines: [
            "只配置知音楼聊天通道：入站使用 Channel SDK 长连接，出站使用 Yach IM OAPI。",
            "本向导会写入账号、SecretRef、私聊配对/allowlist 和群聊策略；不创建日历、文档、会议等功能。",
        ],
    },
    resolveShouldPromptAccountIds: ({ cfg, shouldPromptAccountIds }) => shouldPromptAccountIds || listYachAccountIds(cfg).length > 1,
    resolveAccountIdForConfigure: ({ accountOverride, defaultAccountId }) => accountOverride?.trim() || defaultAccountId,
    stepOrder: "credentials-first",
    credentials: [
        makeCredential({ inputKey: "appKey", label: "appKey", envVar: APP_KEY_ENV }),
        makeCredential({ inputKey: "appSecret", label: "appSecret", envVar: APP_SECRET_ENV }),
    ],
    envShortcut: {
        prompt: `同时使用 ${APP_KEY_ENV} 和 ${APP_SECRET_ENV} 配置默认 Yach IM 账号？`,
        preferredEnvVar: APP_KEY_ENV,
        isAvailable: ({ accountId }) => accountId === DEFAULT_ACCOUNT && Boolean(process.env[APP_KEY_ENV]?.trim() && process.env[APP_SECRET_ENV]?.trim()),
        apply: ({ cfg, accountId }) => accountPatch(cfg, accountId, {
            appKey: { source: "env", provider: "default", id: APP_KEY_ENV },
            appSecret: { source: "env", provider: "default", id: APP_SECRET_ENV },
        }),
    },
    textInputs: [
        {
            inputKey: "botId",
            message: "Yach IM 机器人 botId（可选）：",
            placeholder: "机器人 ID；不确定时可留空",
            required: false,
            applyEmptyValue: false,
            currentValue: ({ cfg, accountId }) => resolveYachAccount(cfg, accountId).botId,
            keepPrompt: (value) => `保留当前 botId ${value}？`,
            normalizeValue: ({ value }) => value.trim(),
            applySet: ({ cfg, accountId, value }) => accountPatch(cfg, accountId, { botId: value.trim() }),
        },
        {
            inputKey: "groupResponseMode",
            message: "Yach IM 群消息响应模式（可选）：",
            placeholder: "mentions（all / humans / mentions / paired）",
            required: false,
            applyEmptyValue: false,
            helpTitle: "Yach IM 群消息响应模式",
            helpLines: [
                "all：所有收到的群消息（含机器人）；humans：仅人类消息；mentions：仅 @ 机器人；paired：仅配对过的发送者。",
                "默认是 mentions：长连接接收允许范围内的群消息并缓存上下文，但只有 @ 机器人时回复；群范围默认 allowlist，DM 配对仍是独立的 dmPolicy。",
            ],
            currentValue: ({ cfg, accountId }) => resolveYachAccount(cfg, accountId).config.groupResponseMode ?? "mentions",
            keepPrompt: (value) => `保留当前群响应模式 ${value}？`,
            validate: ({ value }) => value.trim() && !normalizeYachGroupResponseMode(value)
                ? `请输入 ${YACH_GROUP_RESPONSE_MODES.join(" / ")} 之一。`
                : undefined,
            normalizeValue: ({ value }) => value.trim().toLocaleLowerCase(),
            applySet: ({ cfg, accountId, value }) => accountPatch(cfg, accountId, {
                groupResponseMode: normalizeYachGroupResponseMode(value),
            }),
        },
    ],
    dmPolicy: yachDmPolicy,
    allowFrom: yachAllowFrom,
    groupAccess: yachGroupAccess,
    completionNote: {
        title: "Yach IM 配置完成",
        lines: [
            "重启 Gateway 后，Yach IM 账号会建立长连接。",
            "私聊默认使用 pairing；收到首条消息后可通过 openclaw pairing list yach-im-full 查看，再用 openclaw pairing approve yach-im-full <code> 完成绑定。",
            "群聊默认是 allowlist + mentions：只有明确允许的群会接收长连接消息，且只有被 @ 时回复；可在向导或配置中切换为 open、disabled，以及 all、humans 或 paired。",
            "发送目标支持 user:<userId>、work_code:<工号> 和 group:<conversationId>。",
        ],
    },
    disable: (cfg) => setSetupChannelEnabled(cfg, CHANNEL, false),
};
//# sourceMappingURL=setup.js.map
