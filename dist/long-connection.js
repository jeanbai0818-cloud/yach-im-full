import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/**
 * These endpoints and business identifiers are reference values recovered from
 * openclaw-install-audit. Keep them here so the new implementation has one
 * explicit, reviewable source of truth.
 */
export const YACH_CHANNEL_SDK = {
    appId: "yach20001",
    bizId: "97",
    proxy: {
        protocol: "https",
        hostname: "chatconf.msg.xescdn.com",
        port: 443,
        url: "/v4/proxy/config",
    },
    logServer: {
        protocol: "https",
        hostname: "log.xescdn.com",
        port: 443,
        url: "/log",
    },
};
const RECONNECT_BASE_MS = 5_000;
const RECONNECT_MAX_MS = 5 * 60_000;
const CONNECTED_STATUS = 2;
const DISCONNECTED_STATUSES = new Set([1, 5]);
const require = createRequire(import.meta.url);
const currentDir = dirname(fileURLToPath(import.meta.url));
function loadBundledSdk() {
    return require(join(currentDir, "vendor", "tal-msg-sdk", "index.cjs"));
}
function parseJson(value) {
    if (typeof value !== "string")
        return value;
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
/** Decode the SDK's outer envelope and the JSON data body used by Yach IM. */
export function decodeYachChannelMessage(raw) {
    const envelope = parseJson(raw);
    if (!envelope || typeof envelope !== "object")
        return null;
    const data = parseJson(envelope.data ?? envelope);
    if (!data || typeof data !== "object")
        return null;
    return data;
}
export function reconnectDelayMs(failureCount) {
    const safeCount = Math.max(0, Math.floor(failureCount));
    return Math.min(RECONNECT_BASE_MS * 2 ** safeCount, RECONNECT_MAX_MS);
}
function logSdkFailure(logger, accountId, error) {
    logger.error(`[yach-im-full][${accountId}] ${String(error)}`);
}
/** Start one account's SDK connection. The returned function is idempotent. */
export function startYachLongConnection(params) {
    const { account, logger, onMessage, signal } = params;
    const accountId = account.accountId;
    if (!account.appKey || !account.appSecret) {
        logger.error(`[yach-im-full][${accountId}] appKey/appSecret are required`);
        return () => undefined;
    }
    if (signal?.aborted)
        return () => undefined;
    let sdk;
    try {
        sdk = params.sdkLoader?.() ?? loadBundledSdk();
        logger.debug?.(`[yach-im-full][${accountId}] Channel SDK ${sdk.getVersion?.() ?? "unknown"}`);
    }
    catch (error) {
        logSdkFailure(logger, accountId, error);
        return () => undefined;
    }
    let channel;
    try {
        const client = new sdk(account.channelAppId || YACH_CHANNEL_SDK.appId, "1.0.0");
        client.setSdkConfig({
            proxyConfig: YACH_CHANNEL_SDK.proxy,
            remoteLogConfig: YACH_CHANNEL_SDK.logServer,
            extra: { location: "China", logLevel: "warn" },
        });
        channel = client.getInstance(sdk.CHANNEL);
    }
    catch (error) {
        logSdkFailure(logger, accountId, error);
        return () => undefined;
    }
    let stopped = false;
    let reconnectTimer;
    let failureCount = 0;
    const clearReconnectTimer = () => {
        if (reconnectTimer)
            clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
    };
    const scheduleReconnect = (reason) => {
        if (stopped || reconnectTimer)
            return;
        const delay = reconnectDelayMs(failureCount++);
        params.onStateChange?.({
            connected: false,
            lifecycle: "recovering",
            reconnectAttempts: failureCount,
        });
        logger.warn(`[yach-im-full][${accountId}] ${reason}; reconnect in ${delay}ms`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            if (stopped)
                return;
            try {
                try {
                    channel.unInit();
                }
                catch (error) {
                    logger.warn(`[yach-im-full][${accountId}] unInit before reconnect failed: ${String(error)}`);
                }
                channel.init(YACH_CHANNEL_SDK.bizId, {
                    userId: account.appKey,
                    auth: { params: new Map([["app_key", account.appKey], ["app_secret", account.appSecret]]) },
                });
            }
            catch (error) {
                logSdkFailure(logger, accountId, error);
                scheduleReconnect("init failed");
            }
        }, delay);
    };
    const onNetworkStatus = (status) => {
        const value = status && typeof status === "object"
            ? status.netStatus ?? status.status
            : status;
        const numericStatus = typeof value === "number" ? value : Number(value);
        if (numericStatus === CONNECTED_STATUS) {
            failureCount = 0;
            params.onStateChange?.({ connected: true, lifecycle: "ready", reconnectAttempts: 0 });
            logger.info(`[yach-im-full][${accountId}] Channel SDK connected`);
            return;
        }
        if (DISCONNECTED_STATUSES.has(numericStatus)) {
            scheduleReconnect(`network status ${numericStatus}`);
        }
    };
    const onAuthResponse = (response) => {
        const code = response && typeof response === "object"
            ? response.code
            : undefined;
        if (code !== undefined && Number(code) !== 0) {
            scheduleReconnect(`authentication failed (${String(code)})`);
        }
    };
    const onKickout = (reason) => {
        scheduleReconnect(`kicked out${reason ? `: ${String(reason)}` : ""}`);
    };
    const onReceive = (raw) => {
        const message = decodeYachChannelMessage(raw);
        if (!message) {
            logger.warn(`[yach-im-full][${accountId}] ignored malformed recvMsg payload`);
            return;
        }
        Promise.resolve(onMessage(message)).catch((error) => {
            logSdkFailure(logger, accountId, error);
        });
    };
    channel.on("netStatusChange", onNetworkStatus);
    channel.on("authResponse", onAuthResponse);
    channel.on("kickout", onKickout);
    channel.on("recvMsg", onReceive);
    const cleanup = () => {
        if (stopped)
            return;
        stopped = true;
        clearReconnectTimer();
        try {
            channel.off?.("netStatusChange", onNetworkStatus);
        }
        catch (error) {
            logSdkFailure(logger, accountId, error);
        }
        try {
            channel.off?.("authResponse", onAuthResponse);
        }
        catch (error) {
            logSdkFailure(logger, accountId, error);
        }
        try {
            channel.off?.("kickout", onKickout);
        }
        catch (error) {
            logSdkFailure(logger, accountId, error);
        }
        try {
            channel.off?.("recvMsg", onReceive);
        }
        catch (error) {
            logSdkFailure(logger, accountId, error);
        }
        try {
            channel.unInit();
        }
        catch (error) {
            logSdkFailure(logger, accountId, error);
        }
    };
    signal?.addEventListener("abort", cleanup, { once: true });
    try {
        channel.init(YACH_CHANNEL_SDK.bizId, {
            userId: account.appKey,
            auth: { params: new Map([["app_key", account.appKey], ["app_secret", account.appSecret]]) },
        });
    }
    catch (error) {
        logSdkFailure(logger, accountId, error);
        scheduleReconnect("initial init failed");
    }
    return cleanup;
}
//# sourceMappingURL=long-connection.js.map
