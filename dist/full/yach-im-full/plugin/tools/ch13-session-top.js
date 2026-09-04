/**
 * 会话置顶工具
 * 对应 API: src/api/ch13-session-top/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachAddSessionTop = {
    name: "yach_add_session_top",
    label: "置顶会话",
    description: "置顶会话。写操作，需确认。",
    parameters: Type.Object({
        sessionId: Type.String({ description: "会话 id" }),
        topUid: Type.Optional(Type.String({ description: "置顶用户 id（可选）" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch13-session-top/index.js");
        const result = await ch.addSessionTop(params.sessionId, params.topUid);
        return toolResult(`✅ 已置顶会话 ${params.sessionId}\n${JSON.stringify(result)}`);
    },
};
export const yachRemoveSessionTop = {
    name: "yach_remove_session_top",
    label: "取消会话置顶",
    description: "取消会话置顶。写操作，需确认。",
    parameters: Type.Object({
        sessionId: Type.String({ description: "会话 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch13-session-top/index.js");
        const result = await ch.removeSessionTop(params.sessionId);
        return toolResult(`✅ 已取消置顶会话 ${params.sessionId}\n${JSON.stringify(result)}`);
    },
};
export const yachSortSessionTop = {
    name: "yach_sort_session_top",
    label: "排序置顶会话",
    description: "调整置顶会话排序顺序。写操作，需确认。",
    parameters: Type.Object({
        orders: Type.Array(Type.String(), { description: "会话 id 排序数组（按期望顺序）" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch13-session-top/index.js");
        const result = await ch.sortSessionTop(params.orders);
        return toolResult(`✅ 已调整置顶排序\n${JSON.stringify(result)}`);
    },
};
export const yachGetSessionTopList = {
    name: "yach_get_session_top_list",
    label: "查置顶会话列表",
    description: "查询当前所有置顶会话（复用已有 yach_get_top_sessions）。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const ch = require("../../api/ch1-messaging/index.js");
        const result = await ch.getTopSessions();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetSessionTopConfig = {
    name: "yach_get_session_top_config",
    label: "查置顶配置",
    description: "查询置顶会话配置信息。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const ch = require("../../api/ch13-session-top/index.js");
        const result = await ch.getSessionTopConfig();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachSetSessionTopConfig = {
    name: "yach_set_session_top_config",
    label: "设置置顶配置",
    description: "设置置顶会话配置。写操作，需确认。",
    parameters: Type.Object({
        config: Type.Union([Type.String(), Type.Object({})], { description: "配置对象或 JSON 字符串" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch13-session-top/index.js");
        const result = await ch.setSessionTopConfig(params.config);
        return toolResult(`✅ 已设置置顶配置\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch13-session-top.js.map
