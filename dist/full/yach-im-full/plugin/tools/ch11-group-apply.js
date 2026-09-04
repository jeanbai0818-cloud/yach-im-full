/**
 * 入群申请管理工具
 * 对应 API: src/api/ch11-group-apply/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetGroupApplyList = {
    name: "yach_get_group_apply_list",
    label: "查入群申请列表",
    description: "查询入群申请列表。tid 传群 tid。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.getGroupApplyList(params.tid, { page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachAcceptGroupApply = {
    name: "yach_accept_group_apply",
    label: "接受入群申请",
    description: "接受入群申请。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        userId: Type.String({ description: "申请人 user_id" }),
        reason: Type.Optional(Type.String({ description: "拒绝理由" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.acceptGroupApply(params.tid, params.userId, params.reason);
        return toolResult(`✅ 已接受 ${params.userId} 入群\n${JSON.stringify(result)}`);
    },
};
export const yachRejectGroupApply = {
    name: "yach_reject_group_apply",
    label: "拒绝入群申请",
    description: "拒绝入群申请。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        userId: Type.String({ description: "申请人 user_id" }),
        reason: Type.Optional(Type.String({ description: "拒绝理由" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.rejectGroupApply(params.tid, params.userId, params.reason);
        return toolResult(`✅ 已拒绝 ${params.userId} 入群\n${JSON.stringify(result)}`);
    },
};
export const yachBatchGroupApply = {
    name: "yach_batch_group_apply",
    label: "批量处理入群申请",
    description: "批量处理入群申请 (accept/reject/ignore)。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        userIds: Type.Array(Type.String(), { description: "申请人 user_id 数组" }),
        action: Type.Union([Type.Literal("accept"), Type.Literal("reject"), Type.Literal("ignore")], { description: "操作: accept/reject/ignore" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.batchGroupApply(params.tid, params.userIds, params.action);
        return toolResult(`✅ 已批量${params.action} ${params.userIds.length} 人\n${JSON.stringify(result)}`);
    },
};
export const yachIgnoreGroupApply = {
    name: "yach_ignore_group_apply",
    label: "忽略入群申请",
    description: "忽略入群申请。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        userId: Type.String({ description: "申请人 user_id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.ignoreGroupApply(params.tid, params.userId);
        return toolResult(`✅ 已忽略 ${params.userId} 的入群申请\n${JSON.stringify(result)}`);
    },
};
export const yachGetGroupApplyCount = {
    name: "yach_get_group_apply_count",
    label: "查入群申请数",
    description: "查询入群待处理申请数量。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.getGroupApplyCount(params.tid);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetGroupApplyConfig = {
    name: "yach_get_group_apply_config",
    label: "查入群设置",
    description: "查询群的入群设置。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch11-group-apply/index.js");
        const result = await ch.getGroupApplyConfig(params.tid);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
//# sourceMappingURL=ch11-group-apply.js.map