function lazyHandler(exportName, api) {
    return async (ctx) => {
        const handlers = await import("./full-command-handlers.js");
        return handlers[exportName](api, ctx);
    };
}

export function registerFullCommands(api) {
    const loginDefinition = {
        description: "建立或刷新知音楼登录态：缺少 NIM 凭据时补齐 NIM；NIM 已就绪但 HTTP/CAPI 登录态失效时仅刷新 HTTP/CAPI。",
        requireAuth: true,
        handler: lazyHandler("handleLogin", api),
    };
    api.registerCommand({ name: "yach_login", ...loginDefinition });

    const statusDefinition = {
        description: "查看知音楼登录进度、NIM 长连接和 HTTP/CAPI 凭据状态。",
        requireAuth: true,
        handler: lazyHandler("handleStatus", api),
    };
    api.registerCommand({ name: "yach_status", ...statusDefinition });

    api.registerCommand({
        name: "yach-refresh-token",
        description: "刷新仍有效的知音楼 HTTP/CAPI 登录态，并同步响应中的 NIM 凭据。",
        requireAuth: true,
        handler: lazyHandler("handleRefreshToken", api),
    });

    api.registerCommand({
        name: "yach-response",
        description: "管理 yach-im-full NIM 自动响应白名单。",
        acceptsArgs: true,
        requireAuth: true,
        handler: lazyHandler("handleResponse", api),
    });
}
