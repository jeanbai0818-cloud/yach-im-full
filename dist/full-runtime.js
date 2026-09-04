import { registerFullCommands } from "./full/full-commands.js";
import { registerFullTools, sideEffectingToolNames } from "./full/full-tools.js";

// Keep discovery/setup imports inert. The NIM SDK, browser shims, and auth
// implementation are loaded only when the full runtime actually starts or a
// login command is invoked.
let runtimeApi = null;
const nimService = {
    id: "yach-im-full-nim",
    async start(ctx) {
        const { nimService: implementation } = await import("./full/nim-service.js");
        return implementation.start({ ...ctx, runtime: runtimeApi });
    },
    async stop(ctx) {
        const { nimService: implementation } = await import("./full/nim-service.js");
        return implementation.stop(ctx);
    },
};

function registerFullHttpRoutes(api) {
    if (typeof api.registerHttpRoute !== "function")
        return;
    const jsonRoute = (routePath, fn) => {
        api.registerHttpRoute({
            path: routePath,
            auth: "gateway",
            async handler(req, res) {
                try {
                    const url = new URL(req.url ?? "/", "http://localhost");
                    const body = await fn(url);
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: true, ...body }));
                }
                catch (error) {
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok: false, error: error?.message ?? String(error) }));
                }
                return true;
            },
        });
    };
    jsonRoute("/plugin/yach-im-full/status", async () => {
        const { getNimStatus } = await import("./full/nim-service.js");
        return { ...getNimStatus(), messageStorage: "nim-cloud" };
    });
    jsonRoute("/plugin/yach-im-full/sessions", async (url) => {
        const { getActiveNimListener } = await import("./full/nim-service.js");
        const listener = getActiveNimListener();
        if (!listener?.getSessions)
            throw new Error("NIM listener 未初始化或未连接");
        const limit = Math.max(1, Math.min(200, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
        return { sessions: (await listener.getSessions()).slice(0, limit), source: "nim-cloud" };
    });
    jsonRoute("/plugin/yach-im-full/msgs", async (url) => {
        const { getActiveNimListener } = await import("./full/nim-service.js");
        const listener = getActiveNimListener();
        const sessionId = url.searchParams.get("session");
        if (!listener?.getHistory)
            throw new Error("NIM listener 未初始化或未连接");
        if (!sessionId)
            throw new Error("session 必填");
        const limit = Math.max(1, Math.min(500, Number.parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
        const before = Number.parseInt(url.searchParams.get("before") ?? "0", 10) || undefined;
        return { msgs: await listener.getHistory({ sessionId, limit, endTime: before }) };
    });
}

function registerFullToolApprovals(api) {
    if (typeof api.on !== "function")
        return;
    api.on("before_tool_call", async (event) => {
        const toolName = String(event?.toolName ?? "");
        const params = event?.params && typeof event.params === "object" ? event.params : {};
        const isSharedYachMessage = toolName === "message"
            && String(params.channel ?? params.provider ?? "").toLowerCase() === "yach-im-full"
            && ["send", "react", "delete", "edit"].includes(String(params.action ?? "").toLowerCase());
        if (!sideEffectingToolNames.has(toolName) && !isSharedYachMessage)
            return;
        const action = isSharedYachMessage ? `message:${String(params.action ?? "send")}` : toolName;
        const destructive = /(?:dismiss|delete|remove|recall|change_group_owner|set_group_admin|mute_group|quit_group|set_user_info|set_workstate|upload_avatar|del_side_bar_nav|set_side_bar_conf)/i.test(action);
        return {
            requireApproval: {
                title: `允许 Yach IM 操作：${action}`.slice(0, 80),
                description: "该操作会向知音楼发送消息或修改外部数据；请确认目标和参数后再执行。",
                severity: destructive ? "critical" : "warning",
                allowedDecisions: ["allow-once", "deny"],
                timeoutMs: 120_000,
            },
        };
    });
}

export function registerFullRuntime(api) {
    // Tool discovery must expose capabilities only. In particular it must not
    // start NIM, register background services, or publish Gateway routes.
    if (api.registrationMode === "tool-discovery") {
        registerFullTools(api);
        return;
    }
    if (api.registrationMode && api.registrationMode !== "full")
        return;
    runtimeApi = api.runtime;
    api.registerService(nimService);
    registerFullCommands(api);
    registerFullTools(api);
    registerFullHttpRoutes(api);
    registerFullToolApprovals(api);
}
