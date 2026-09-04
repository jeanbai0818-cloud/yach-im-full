import { DEFAULT_ACCOUNT_ID, createChatChannelPlugin } from "openclaw/plugin-sdk/core";
import { formatTrimmedAllowFromEntries } from "openclaw/plugin-sdk/channel-config-helpers";
import { buildDmGroupAccountAllowlistAdapter } from "openclaw/plugin-sdk/allowlist-config-edit";
import {
    defaultYachAccountId,
    describeYachAccount,
    inspectYachAccount,
    listYachAccountIds,
    patchYachAccountConfig,
    resolveYachAccount,
} from "./config.js";
import { yachSetupContract, yachSetupWizard } from "./setup.js";

const yachSetupPlugin = createChatChannelPlugin({
    base: {
        id: "yach-im-full",
        meta: {
            id: "yach-im-full",
            label: "Yach IM Full",
            selectionLabel: "Yach IM Full (知音楼)",
            aliases: ["zhiyinlou"],
            docsPath: "/channels/yach-im-full",
            blurb: "知音楼企业 IM，标准聊天通道与 NIM 工具共用 yach-im-full 身份。",
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
        reload: { configPrefixes: ["channels.yach-im-full"] },
        config: {
            listAccountIds: listYachAccountIds,
            resolveAccount: resolveYachAccount,
            defaultAccountId: defaultYachAccountId,
            isEnabled: (account) => account.enabled,
            isConfigured: (account) => account.configured,
            inspectAccount: (cfg, accountId) => inspectYachAccount(cfg, accountId),
            unconfiguredReason: () => "缺少 appKey 或 appSecret",
            disabledReason: () => "Yach IM 账号已禁用",
            resolveAllowFrom: ({ cfg, accountId }) => resolveYachAccount(cfg, accountId).allowFrom,
            formatAllowFrom: ({ allowFrom }) => formatTrimmedAllowFromEntries(allowFrom),
            describeAccount: (account) => describeYachAccount(account),
            setAccountEnabled: ({ cfg, accountId, enabled }) => patchYachAccountConfig(cfg, accountId, { enabled }),
            deleteAccount: ({ cfg, accountId }) => {
                const channels = cfg.channels ?? {};
                const yachIm = channels["yach-im-full"] && typeof channels["yach-im-full"] === "object"
                    ? channels["yach-im-full"]
                    : {};
                if (accountId === DEFAULT_ACCOUNT_ID) {
                    const { appKey: _appKey, appSecret: _appSecret, botId: _botId, ...rest } = yachIm;
                    return { ...cfg, channels: { ...channels, "yach-im-full": rest } };
                }
                const accounts = yachIm.accounts && typeof yachIm.accounts === "object" ? yachIm.accounts : {};
                const accountKey = Object.keys(accounts).find((key) => key.trim().toLowerCase() === accountId.trim().toLowerCase());
                if (!accountKey)
                    return cfg;
                const { [accountKey]: _removed, ...remaining } = accounts;
                return { ...cfg, channels: { ...channels, "yach-im-full": { ...yachIm, accounts: remaining } } };
            },
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
});

export { yachSetupPlugin };
