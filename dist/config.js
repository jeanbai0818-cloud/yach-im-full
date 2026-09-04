import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk/account-id";
import { resolveMergedAccountConfig } from "openclaw/plugin-sdk/account-helpers";
import { hasConfiguredSecretInput, resolveConfiguredSecretInputString } from "openclaw/plugin-sdk/secret-input-runtime";
const DEFAULT_CHANNEL_APP_ID = "yach20001";
const DEFAULT_BASE_URL = "https://yach-oapi.zhiyinlou.com";
function readYachConfig(cfg) {
    const channels = cfg.channels;
    const raw = channels?.["yach-im-full"];
    return raw && typeof raw === "object" ? raw : {};
}
function asRecord(value) {
    return value && typeof value === "object" ? value : {};
}
/**
 * Apply an account-scoped patch using the same hybrid layout that the runtime
 * resolver reads: the default account lives at channels["yach-im-full"], named
 * accounts live below channels["yach-im-full"].accounts.<accountId>.
 */
export function patchYachAccountConfig(cfg, accountId, patch) {
    const channels = asRecord(cfg.channels);
    const yachIm = asRecord(channels["yach-im-full"]);
    const normalizedId = normalizeAccountId(accountId);
    if (normalizedId === DEFAULT_ACCOUNT_ID) {
        return {
            ...cfg,
            channels: { ...channels, "yach-im-full": { ...yachIm, ...patch } },
        };
    }
    const accounts = asRecord(yachIm.accounts);
    const existingKey = Object.keys(accounts).find((key) => normalizeAccountId(key) === normalizedId) ?? normalizedId;
    const current = asRecord(accounts[existingKey]);
    return {
        ...cfg,
        channels: {
            ...channels,
            "yach-im-full": {
                ...yachIm,
                accounts: { ...accounts, [existingKey]: { ...current, ...patch } },
            },
        },
    };
}
function normalizeAllowList(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((entry) => String(entry).trim()).filter(Boolean);
}
export function listYachAccountIds(cfg) {
    const config = readYachConfig(cfg);
    const ids = Object.keys(config.accounts ?? {}).map(normalizeAccountId).filter(Boolean);
    return ids.length > 0 ? Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b)) : [DEFAULT_ACCOUNT_ID];
}
export function defaultYachAccountId(cfg) {
    const ids = listYachAccountIds(cfg);
    return ids.includes(DEFAULT_ACCOUNT_ID) ? DEFAULT_ACCOUNT_ID : ids[0] ?? DEFAULT_ACCOUNT_ID;
}
export function resolveYachAccount(cfg, accountId) {
    const normalizedId = normalizeAccountId(accountId ?? DEFAULT_ACCOUNT_ID);
    const config = readYachConfig(cfg);
    // Use OpenClaw's shared account inheritance implementation. Apart from
    // keeping named-account behavior aligned with the host, this preserves
    // explicit empty collections and prevents the security auditor from
    // seeing a different effective policy than the runtime.
    const account = resolveMergedAccountConfig({
        channelConfig: config,
        accounts: asRecord(config.accounts),
        accountId: normalizedId,
        normalizeAccountId,
    });
    const appKey = typeof account.appKey === "string" ? account.appKey.trim() || undefined : undefined;
    const appSecret = typeof account.appSecret === "string" ? account.appSecret.trim() || undefined : undefined;
    const secretDefaults = cfg.secrets?.defaults;
    const appKeyConfigured = Boolean(appKey || hasConfiguredSecretInput(account.appKey, secretDefaults));
    const appSecretConfigured = Boolean(appSecret || hasConfiguredSecretInput(account.appSecret, secretDefaults));
    const normalizedConfig = {
        ...account,
        ...(account.allowFrom !== undefined ? { allowFrom: normalizeAllowList(account.allowFrom) } : {}),
        ...(account.groupAllowFrom !== undefined ? { groupAllowFrom: normalizeAllowList(account.groupAllowFrom) } : {}),
        ...(account.groupSenderAllowFrom !== undefined ? { groupSenderAllowFrom: normalizeAllowList(account.groupSenderAllowFrom) } : {}),
    };
    return {
        accountId: normalizedId,
        name: account.name,
        enabled: account.enabled !== false,
        configured: appKeyConfigured && appSecretConfigured,
        appKey,
        appSecret,
        botId: account.botId?.trim() || undefined,
        baseUrl: account.baseUrl?.trim() || DEFAULT_BASE_URL,
        channelAppId: account.channelAppId?.trim() || DEFAULT_CHANNEL_APP_ID,
        connectionMode: "channel",
        dmPolicy: account.dmPolicy ?? "pairing",
        allowFrom: normalizeAllowList(account.allowFrom),
        // Match OpenClaw's fail-closed channel default. A setup flow may write
        // an explicit policy, but an omitted policy must not make every group
        // reachable.
        groupPolicy: account.groupPolicy ?? "allowlist",
        groupAllowFrom: normalizeAllowList(account.groupAllowFrom),
        config: normalizedConfig,
    };
}
export async function resolveYachAccountSecrets(cfg, account) {
    const resolve = async (value, path, fallback) => {
        if (typeof value === "string")
            return value.trim() || undefined;
        if (!value || typeof value !== "object")
            return fallback;
        const result = await resolveConfiguredSecretInputString({
            config: cfg,
            env: process.env,
            value,
            path,
        });
        return result.value?.trim() || fallback;
    };
    const config = readYachConfig(cfg);
    const namedAccountKey = Object.keys(config.accounts ?? {}).find((key) => normalizeAccountId(key) === account.accountId);
    const configPath = namedAccountKey
        ? `.accounts.${namedAccountKey}`
        : account.accountId === DEFAULT_ACCOUNT_ID ? "" : `.accounts.${account.accountId}`;
    const appKey = await resolve(account.config.appKey, `channels.yach-im-full${configPath}.appKey`, account.appKey);
    const appSecret = await resolve(account.config.appSecret, `channels.yach-im-full${configPath}.appSecret`, account.appSecret);
    return {
        ...account,
        appKey,
        appSecret,
        configured: Boolean(appKey && appSecret),
    };
}
export function resolveYachAccountByBotId(cfg, botId) {
    const pluginConfig = readYachConfig(cfg);
    if (botId) {
        if (pluginConfig.botId === botId)
            return resolveYachAccount(cfg, DEFAULT_ACCOUNT_ID);
        const match = Object.entries(pluginConfig.accounts ?? {}).find(([, account]) => account.botId === botId);
        if (match)
            return resolveYachAccount(cfg, match[0]);
    }
    return resolveYachAccount(cfg, DEFAULT_ACCOUNT_ID);
}
export function describeYachAccount(account) {
    return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: account.configured,
        connectionMode: account.connectionMode,
        channelAppId: account.channelAppId,
        baseUrl: account.baseUrl,
        appKey: account.appKey ? "configured" : "missing",
        appSecret: account.appSecret ? "configured" : "missing",
        dmPolicy: account.dmPolicy,
        groupPolicy: account.groupPolicy,
        groupResponseMode: account.config.groupResponseMode ?? "mentions",
        requireMention: account.config.requireMention ?? true,
        allowBots: account.config.allowBots ?? true,
    };
}
/**
 * Read-only account projection used by OpenClaw security audit and discovery.
 * It intentionally retains the resolved `config` shape (the audit resolver
 * needs policy fields there) while masking literal credentials.
 */
export function inspectYachAccount(cfg, accountId) {
    const account = resolveYachAccount(cfg, accountId);
    const redactSecret = (value) => {
        if (typeof value === "string")
            return value.trim() ? "[configured]" : undefined;
        return value;
    };
    return {
        ...account,
        appKey: account.appKey ? "[configured]" : undefined,
        appSecret: account.appSecret ? "[configured]" : undefined,
        config: {
            ...account.config,
            appKey: redactSecret(account.config.appKey),
            appSecret: redactSecret(account.config.appSecret),
        },
    };
}
//# sourceMappingURL=config.js.map
