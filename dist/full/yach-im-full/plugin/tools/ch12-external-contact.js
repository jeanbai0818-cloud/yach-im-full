/**
 * 外部联系人管理工具
 * 对应 API: src/api/ch12-external-contact/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachAddExternalContact = {
    name: "yach_add_external_contact",
    label: "添加外部联系人",
    description: "添加外部联系人。写操作，需确认。",
    parameters: Type.Object({
        userId: Type.String({ description: "用户 user_id" }),
        reason: Type.Optional(Type.String({ description: "添加理由" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch12-external-contact/index.js");
        const result = await ch.addExternalContact(params.userId, params.reason);
        return toolResult(`✅ 已向 ${params.userId} 发送外部联系人请求\n${JSON.stringify(result)}`);
    },
};
export const yachHandleExternalApply = {
    name: "yach_handle_external_apply",
    label: "处理外部联系人请求",
    description: "处理外部联系人添加请求。写操作，需确认。",
    parameters: Type.Object({
        applyId: Type.String({ description: "申请 id" }),
        accept: Type.Optional(Type.Boolean({ description: "true=接受, false=拒绝", default: true })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch12-external-contact/index.js");
        const result = await ch.handleExternalApply(params.applyId, params.accept !== false);
        return toolResult(`✅ 已${params.accept !== false ? "接受" : "拒绝"}外部联系人请求 ${params.applyId}\n${JSON.stringify(result)}`);
    },
};
export const yachGetExternalApplyStatus = {
    name: "yach_get_external_apply_status",
    label: "查外部联系人申请状态",
    description: "查询外部联系人添加请求状态。",
    parameters: Type.Object({
        applyId: Type.String({ description: "申请 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch12-external-contact/index.js");
        const result = await ch.getExternalApplyStatus(params.applyId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachListMyExternalApps = {
    name: "yach_list_my_external_apps",
    label: "查我发起的外部联系人请求",
    description: "查看我发起的外部联系人添加请求列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch12-external-contact/index.js");
        const result = await ch.listMyExternalApps({ page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachListExternalContacts = {
    name: "yach_list_external_contacts",
    label: "查外部联系人列表",
    description: "查询外部联系人列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 50 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch12-external-contact/index.js");
        const result = await ch.listExternalContacts({ page: params.page ?? 1, pagesize: params.pagesize ?? 50 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachDeleteExternalContact = {
    name: "yach_delete_external_contact",
    label: "删除外部联系人",
    description: "删除外部联系人。写操作，需确认。",
    parameters: Type.Object({
        userId: Type.String({ description: "联系人 user_id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch12-external-contact/index.js");
        const result = await ch.deleteExternalContact(params.userId);
        return toolResult(`✅ 已删除外部联系人 ${params.userId}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch12-external-contact.js.map