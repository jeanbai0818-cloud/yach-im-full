/**
 * 讨论组管理工具
 * 对应 API: src/api/ch24-discuss/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachCreateDiscussGroup = {
    name: "yach_create_discuss_group",
    label: "创建讨论组",
    description: "创建讨论组。写操作，需确认。",
    parameters: Type.Object({
        title: Type.String({ description: "讨论组标题" }),
        memberIds: Type.Array(Type.String(), { description: "成员 user_id 数组" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.createDiscuss(params.title, params.memberIds || []);
        return toolResult(`✅ 已创建讨论组「${params.title}」\n${JSON.stringify(result)}`);
    },
};
export const yachGetDiscussInfo = {
    name: "yach_get_discuss_info",
    label: "查讨论组信息",
    description: "查询讨论组信息。",
    parameters: Type.Object({
        groupId: Type.String({ description: "讨论组 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.getDiscussInfo(params.groupId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachJoinDiscussGroup = {
    name: "yach_join_discuss_group",
    label: "加入讨论组",
    description: "加入讨论组。写操作，需确认。",
    parameters: Type.Object({
        groupId: Type.String({ description: "讨论组 id" }),
        userId: Type.String({ description: "加入者 user_id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.joinDiscuss(params.groupId, params.userId);
        return toolResult(`✅ 已加入讨论组 ${params.groupId}\n${JSON.stringify(result)}`);
    },
};
export const yachDismissDiscussGroup = {
    name: "yach_dismiss_discuss_group",
    label: "解散讨论组",
    description: "解散讨论组。写操作，需确认。",
    parameters: Type.Object({
        groupId: Type.String({ description: "讨论组 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.dismissDiscuss(params.groupId);
        return toolResult(`✅ 已解散讨论组 ${params.groupId}\n${JSON.stringify(result)}`);
    },
};
export const yachSetDiscussGroupTitle = {
    name: "yach_set_discuss_group_title",
    label: "设讨论组标题",
    description: "设置讨论组标题。写操作，需确认。",
    parameters: Type.Object({
        groupId: Type.String({ description: "讨论组 id" }),
        title: Type.String({ description: "新标题" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.setDiscussTitle(params.groupId, params.title);
        return toolResult(`✅ 已设置讨论组标题为「${params.title}」\n${JSON.stringify(result)}`);
    },
};
export const yachAddUserToDiscussion = {
    name: "yach_add_user_to_discussion",
    label: "加讨论组成员",
    description: "向讨论组添加成员。写操作，需确认。",
    parameters: Type.Object({
        groupId: Type.String({ description: "讨论组 id" }),
        userId: Type.String({ description: "成员 user_id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.addUserToDiscussion(params.groupId, params.userId);
        return toolResult(`✅ 已添加成员 ${params.userId} 到讨论组\n${JSON.stringify(result)}`);
    },
};
export const yachGetDiscussMsgList = {
    name: "yach_get_discuss_msg_list",
    label: "查讨论组消息",
    description: "查询讨论组消息列表。",
    parameters: Type.Object({
        groupId: Type.String({ description: "讨论组 id" }),
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch24-discuss/index.js");
        const result = await ch.getDiscussMsgList(params.groupId, { page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
//# sourceMappingURL=ch17-discuss.js.map