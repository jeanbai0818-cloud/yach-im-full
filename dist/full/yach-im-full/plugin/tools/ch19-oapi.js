/**
 * 知音楼 Agent 工具集 — 开放平台
 *
 * 调用 API: ../../api/ch29-oapi/index.js
 *
 * 工具列表：
 *   yachOapiMessageSingleSend — 单发消息（写）
 *   yachOapiRobotsList        — 机器人列表
 *   yachGetOapiDetail         — 应用详情
 *   yachGetAppPushState       — 推送状态
 *   yachSetAppPush            — 推送设置（写）
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachOapiMessageSingleSend = {
    name: "yach_oapi_message_single_send",
    label: "开放平台单发消息（写）",
    description: "通过开放平台接口向指定用户单发消息。写操作，执行前需用户确认。",
    parameters: Type.Object({
        receiverId: Type.String({ description: "接收方 user.id" }),
        content: Type.String({ description: "文本消息内容" }),
        agentId: Type.Optional(Type.String({ description: "应用 agent_id（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch29 = require("../../api/ch29-oapi/index.js");
        const result = await ch29.oapiMessageSingleSend({
            toUserId: params.receiverId,
            content: params.content,
            agentId: params.agentId,
        });
        return toolResult(`✅ 已发送开放平台文本消息\nto=${params.receiverId}\n${JSON.stringify(result)}`);
    },
};
export const yachOapiRobotsList = {
    name: "yach_oapi_robots_list",
    label: "开放平台机器人列表",
    description: "获取开放平台已注册的机器人列表。只读。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码，默认 1" })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量，默认 20" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch29 = require("../../api/ch29-oapi/index.js");
        const result = await ch29.getOapiRobotsList(params.page ?? 1, params.pagesize ?? 20);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetOapiDetail = {
    name: "yach_get_oapi_detail",
    label: "开放平台应用详情",
    description: "获取开放平台应用的详细信息。appId 从列表获取。只读。",
    parameters: Type.Object({
        appId: Type.String({ description: "应用 id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch29 = require("../../api/ch29-oapi/index.js");
        const result = await ch29.getOapiDetail(params.appId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetAppPushState = {
    name: "yach_get_app_push_state",
    label: "应用推送状态",
    description: "获取应用的推送状态配置。appId 可选，不传查全局状态。只读。",
    parameters: Type.Object({
        appId: Type.Optional(Type.String({ description: "应用 id（可选，不传查全局）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch29 = require("../../api/ch29-oapi/index.js");
        const result = await ch29.getAppPushState(params.appId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachSetAppPush = {
    name: "yach_set_app_push",
    label: "设置推送（写）",
    description: "设置应用的推送开关/配置。写操作，执行前需用户确认。",
    parameters: Type.Object({
        appId: Type.String({ description: "应用 id" }),
        enabled: Type.Boolean({ description: "true=开启推送, false=关闭推送" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch29 = require("../../api/ch29-oapi/index.js");
        const result = await ch29.setAppPush({ appId: params.appId, enabled: params.enabled });
        return toolResult(`✅ 已${params.enabled ? "开启" : "关闭"}推送${params.appId ? ` appId=${params.appId}` : ""}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch19-oapi.js.map