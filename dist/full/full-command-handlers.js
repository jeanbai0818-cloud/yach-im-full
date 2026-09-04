import { createRequire } from "node:module";
import path from "node:path";
import { getNimStatus, startNimFromLogin } from "./nim-service.js";

const require = createRequire(import.meta.url);
const { login } = require("./auth/login.cjs");
const { loadSession, saveSession } = require("./auth/session.cjs");
const orgApi = require("./yach-im-full/api/ch9-org/index.js");
const { normalizeResponsePolicy } = require("./yach-im-full/daemon/response-policy.js");

const OUTBOUND_TIMEOUT_MS = 5_000;
let loginState = { running: false };

function credentialSummary() {
    try {
        const session = loadSession();
        return {
            nimReady: Boolean(session?.user?.id && session?.cloudtoken),
            httpPresent: Boolean(session?.token && session?.accesstoken),
            tokenUpdatedAt: session?.tokenUpdatedAt ? Number(session.tokenUpdatedAt) : 0,
        };
    }
    catch {
        return { nimReady: false, httpPresent: false, tokenUpdatedAt: 0 };
    }
}

function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
    ]).finally(() => clearTimeout(timer));
}

function routeFromContext(api, ctx) {
    let delivery;
    if (ctx.sessionKey) {
        try {
            delivery = api.runtime.agent.session.getSessionEntry({
                sessionKey: ctx.sessionKey,
                ...(ctx.agentId ? { agentId: ctx.agentId } : {}),
                readConsistency: "latest",
            })?.deliveryContext;
        }
        catch (error) {
            api.logger.warn?.(`[yach-im-full] 会话投递路由读取失败：${error.message ?? error}`);
        }
    }
    return {
        channel: delivery?.channel ?? ctx.channelId ?? ctx.channel,
        target: delivery?.to ?? ctx.from ?? ctx.senderId ?? ctx.to,
        account: delivery?.accountId ?? ctx.accountId,
        threadId: delivery?.threadId ?? ctx.messageThreadId,
    };
}

async function pushToSession(api, route, text, mediaPath) {
    if (!route.channel || !route.target)
        return false;
    try {
        const adapter = await api.runtime.channel.outbound.loadAdapter(route.channel);
        const send = mediaPath ? adapter?.sendMedia : adapter?.sendText;
        if (!send)
            return false;
        await withTimeout(send({
            cfg: api.config,
            to: route.target,
            text,
            ...(mediaPath
                ? { mediaUrl: mediaPath, mediaLocalRoots: [path.dirname(mediaPath)] }
                : {}),
            ...(route.account ? { accountId: route.account } : {}),
            ...(route.threadId != null ? { threadId: route.threadId } : {}),
        }), OUTBOUND_TIMEOUT_MS, "登录结果主动发送超时");
        return true;
    }
    catch (error) {
        api.logger.warn?.(`[yach-im-full] 登录结果发送失败：${error.message ?? error}`);
        return false;
    }
}

function waitFor(getter, timeoutMs) {
    const started = Date.now();
    return new Promise((resolve) => {
        const check = () => {
            const value = getter();
            if (value !== undefined || Date.now() - started >= timeoutMs)
                return resolve(value);
            setTimeout(check, 100);
        };
        check();
    });
}

export async function handleLogin(api, ctx) {
    const route = routeFromContext(api, ctx);
    const currentCredentials = credentialSummary();
    const loginPurpose = currentCredentials.nimReady
        ? "NIM 已复用现有本机登录态；本次二维码仅用于刷新 HTTP/CAPI 登录态"
        : "本次二维码登录会取得 HTTP/CAPI 登录态，并补齐 NIM cloudtoken";
    if (loginState.running) {
        return loginState.imgPath
            ? {
                text: `登录二维码仍在有效期内，请扫码确认（${loginPurpose}）；完成后可用 /yach_status 查看。`,
                mediaUrl: loginState.imgPath,
                trustedLocalMedia: true,
            }
            : { text: "登录正在进行中，请稍候；完成后可用 /yach_status 查看。" };
    }

    loginState = { running: true, qrDelivery: "pending" };
    void login({
        timeout: 60_000,
        onQr: async ({ url, imgPath }) => {
            loginState.url = url;
            loginState.imgPath = imgPath;
            const sent = await pushToSession(api, route, `📱 知音楼登录二维码已生成（60 秒有效），请扫码并在手机上确认\n${loginPurpose}`, imgPath);
            loginState.qrDelivery = sent ? "sent" : "fallback";
        },
        onStatus: async (status) => {
            if (status === "scanned" || status === "confirmed_pending") {
                await pushToSession(api, route, status === "scanned" ? "✅ 已收到扫码，请在手机上点击「确认登录」" : "✅ 手机已确认，正在等待登录凭证");
            }
        },
    }).then(async (session) => {
        loginState.running = false;
        const nim = await startNimFromLogin();
        loginState.result = `✅ 登录成功：${session.user?.name || "知音楼用户"}（${session.user?.id || "-"}）${nim.started ? "；NIM 长连接正在启动" : `；NIM 未启动：${nim.reason}`}`;
        api.logger.info?.(`[yach-im-full] ${loginState.result}`);
        await pushToSession(api, route, `🎉 知音楼登录成功！\n用户：${session.user?.name || "-"}（${session.user?.id || "-"}）\n${nim.started ? "NIM 长连接正在启动。" : `NIM 尚未启动：${nim.reason}；请重启 Gateway。`}`);
    }).catch(async (error) => {
        loginState.running = false;
        loginState.error = error?.message ?? String(error);
        api.logger.error?.(`[yach-im-full] 登录失败：${loginState.error}`);
        await pushToSession(api, route, `❌ 知音楼登录失败：${loginState.error}`);
    });

    await waitFor(() => loginState.qrDelivery === "sent" || loginState.qrDelivery === "fallback" ? loginState.qrDelivery : loginState.error, 8_000);
    if (loginState.error && !loginState.imgPath)
        return { text: `❌ 知音楼登录失败：${loginState.error}` };
    if (loginState.qrDelivery === "sent")
        return { text: `二维码已发送到当前对话，请在 60 秒内扫码并确认（${loginPurpose}）；完成后可用 /yach_status 查看。` };
    if (loginState.imgPath)
        return {
            text: loginState.url ? `📱 请用知音楼 APP 扫码并确认（60 秒有效）：\n${loginState.url}\n${loginPurpose}` : `📱 请扫码并确认登录。\n${loginPurpose}`,
            mediaUrl: loginState.imgPath,
            trustedLocalMedia: true,
        };
    return { text: loginState.url ? `请扫码或打开链接完成登录：\n${loginState.url}\n${loginPurpose}` : `正在生成登录二维码，请稍候再用 /yach_status 查看。\n${loginPurpose}` };
}

export async function handleStatus() {
    const status = getNimStatus();
    const credentials = credentialSummary();
    const login = loginState.running
        ? "🔄 登录进行中（等待扫码/确认）"
        : loginState.result || (loginState.error ? `❌ 上次登录失败：${loginState.error}` : "登录状态：未发起");
    return {
        text: [
            login,
            `NIM 服务：${status.serviceRunning ? "✅ 已运行" : "❌ 未运行"}`,
            `NIM 账号：${status.accountId || "-"}`,
            `NIM 长连接：${status.connected ? "✅ 已连接" : "❌ 未连接"}`,
            `HTTP/CAPI 凭据：${credentials.httpPresent ? "✅ 已保存（有效性需实际调用确认）" : "❌ 缺失"}`,
            credentials.tokenUpdatedAt ? `HTTP/CAPI 最后保存：${new Date(credentials.tokenUpdatedAt).toISOString()}` : "HTTP/CAPI 最后保存：-",
            "Channel SDK 机器人连接仍由 yach-im-full 通道独立维护。",
        ].join("\n"),
    };
}

export async function handleRefreshToken() {
    const refreshed = await orgApi.refreshToken();
    const session = loadSession();
    const next = {
        ...session,
        ...refreshed,
        user: { ...(session.user || {}), ...(refreshed?.user || {}) },
    };
    if (!next.cloudtoken && refreshed?.cloudToken)
        next.cloudtoken = refreshed.cloudToken;
    saveSession(next);
    const nim = await startNimFromLogin();
    return {
        text: `✅ 知音楼 HTTP/CAPI 登录态已刷新并保存；如响应包含 cloudtoken，NIM 凭据也已同步。${nim.started ? "NIM 长连接正在重新启动。" : `NIM 长连接未启动：${nim.reason}`}`,
    };
}

export async function handleResponse(api, ctx) {
    const rawArgs = String(ctx.args ?? "").trim();
    const parts = rawArgs.split(/\s+/u).filter(Boolean);
    const action = String(parts[0] || "help").toLowerCase();
    const currentConfig = api.runtime.config.current();
    const policy = normalizeResponsePolicy(currentConfig);
    const statusText = (next = policy) => [
        `NIM 自动响应：${next.enabled ? "✅ 已开启" : "⏸️ 已关闭"}`,
        `P2P 白名单：${next.p2pAllow.length ? next.p2pAllow.join(", ") : "（空）"}`,
        `群全量响应：${next.groupAlways.length ? next.groupAlways.join(", ") : "（空）"}`,
        `群 @我响应：${next.groupMention.length ? next.groupMention.join(", ") : "（空）"}`,
        "消息正文不会写入本地消息库；自动响应 Agent 只允许调用只读工具。",
    ].join("\n");
    if (action === "help" || action === "status" || action === "状态") {
        return {
            text: action === "status" || action === "状态"
                ? statusText()
                : [
                    "用法：",
                    "/yach-response status",
                    "/yach-response on|off",
                    "/yach-response p2p add|remove <user.id>",
                    "/yach-response group always|mention|off <team.tid>",
                    "/yach-response clear",
                ].join("\n"),
        };
    }
    const hasAdminScope = Array.isArray(ctx.gatewayClientScopes)
        && ctx.gatewayClientScopes.includes("operator.admin");
    if (ctx.senderIsOwner !== true && !hasAdminScope)
        return { text: "⚠️ 只有 OpenClaw owner 或 operator.admin 可以修改自动响应白名单。" };
    const normalizeId = (value) => {
        const id = String(value ?? "").trim();
        return id && !/[\s:]/u.test(id) ? id : "";
    };
    const next = {
        ...policy,
        p2pAllow: [...policy.p2pAllow],
        groupAlways: [...policy.groupAlways],
        groupMention: [...policy.groupMention],
    };
    const add = (key, id) => { if (!next[key].includes(id)) next[key].push(id); };
    const remove = (key, id) => { next[key] = next[key].filter((value) => value !== id); };
    if (action === "on" || action === "开启") {
        if (!next.p2pAllow.length && !next.groupAlways.length && !next.groupMention.length)
            return { text: "请先添加至少一条 P2P 或群响应规则，再开启自动响应。" };
        next.enabled = true;
    }
    else if (action === "off" || action === "关闭") next.enabled = false;
    else if (action === "clear" || action === "清空") {
        next.enabled = false;
        next.p2pAllow = [];
        next.groupAlways = [];
        next.groupMention = [];
    }
    else if (action === "p2p") {
        const operation = String(parts[1] || "").toLowerCase();
        const id = normalizeId(parts[2]);
        if (!["add", "remove", "增加", "删除"].includes(operation) || !id)
            return { text: "用法：/yach-response p2p add|remove <真实 user.id>" };
        if (["add", "增加"].includes(operation)) {
            add("p2pAllow", id);
            next.enabled = true;
        }
        else remove("p2pAllow", id);
    }
    else if (action === "group" || action === "群") {
        const operation = String(parts[1] || "").toLowerCase();
        const id = normalizeId(parts[2]);
        if (!["always", "mention", "off", "全量", "@我", "删除"].includes(operation) || !id)
            return { text: "用法：/yach-response group always|mention|off <真实 team.tid>" };
        if (["always", "全量"].includes(operation)) {
            add("groupAlways", id);
            remove("groupMention", id);
            next.enabled = true;
        }
        else if (["mention", "@我"].includes(operation)) {
            add("groupMention", id);
            remove("groupAlways", id);
            next.enabled = true;
        }
        else {
            remove("groupAlways", id);
            remove("groupMention", id);
        }
    }
    else return { text: "参数无效，请使用 /yach-response help 查看用法。" };
    await api.runtime.config.mutateConfigFile({
        afterWrite: { mode: "none", reason: "yach-im-full 自动响应策略已即时更新，无需重启" },
        mutate: (draft) => {
            draft.plugins ||= {};
            draft.plugins.entries ||= {};
            const existing = draft.plugins.entries["yach-im-full"] || {};
            draft.plugins.entries["yach-im-full"] = {
                ...existing,
                enabled: existing.enabled !== false,
                config: {
                    ...(existing.config || {}),
                    responsePolicy: {
                        ...(existing.config?.responsePolicy || {}),
                        enabled: next.enabled,
                        p2pAllow: next.p2pAllow,
                        groupAlways: next.groupAlways,
                        groupMention: next.groupMention,
                    },
                },
            };
        },
    });
    return { text: statusText(next) };
}
