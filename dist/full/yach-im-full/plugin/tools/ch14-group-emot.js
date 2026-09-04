/**
 * 群表情管理工具
 * 对应 API: src/api/ch14-group-emot/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetGroupEmotList = {
    name: "yach_get_group_emot_list",
    label: "查群表情列表",
    description: "查询群表情列表。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch14-group-emot/index.js");
        const result = await ch.getGroupEmotList(params.tid);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetGroupEmotOne = {
    name: "yach_get_group_emot_one",
    label: "查单个群表情",
    description: "查询单个群表情详情。",
    parameters: Type.Object({
        emotId: Type.String({ description: "表情 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch14-group-emot/index.js");
        const result = await ch.getGroupEmotOne(params.emotId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachAddGroupEmot = {
    name: "yach_add_group_emot",
    label: "添加群表情",
    description: "添加群表情到群里。写操作，需确认。",
    parameters: Type.Object({
        sessionId: Type.String({ description: "群会话 id（群 tid）" }),
        msgId: Type.String({ description: "关联消息 id；必须来自真实群消息，不能临时生成" }),
        emot: Type.String({ description: "表情文本，如 [点赞]" }),
        currTime: Type.Optional(Type.Integer({ description: "事件时间戳（秒）；默认当前时间" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch14-group-emot/index.js");
        const result = await ch.addGroupEmot({
            session_id: params.sessionId,
            msg_id: params.msgId,
            emot: params.emot,
            curr_time: params.currTime,
        });
        return toolResult(`✅ 已添加群表情\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch14-group-emot.js.map