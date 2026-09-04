/**
 * 知音楼 Agent 工具集 — 投票详情
 *
 * 调用 API: ../../api/ch31-vote/index.js
 *
 * 工具列表：
 *   yachGetVoteDetail    — 投票详情
 *   yachAddVoteChoice    — 选择答案（写）
 *   yachGetVoteCount     — 投票计数
 *   yachIntelloftVote    — 投票（写）
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetVoteDetail = {
    name: "yach_get_vote_detail",
    label: "投票详情",
    description: "获取投票详情（题目/选项/参与人/投票状态等）。voteId 从投票消息获取。只读。",
    parameters: Type.Object({
        voteId: Type.String({ description: "投票 id" }),
        msgId: Type.Optional(Type.String({ description: "投票所在消息 id；缺省时兼容使用 voteId" })),
        sessionId: Type.Optional(Type.String({ description: "群会话 tid（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch31 = require("../../api/ch31-vote/index.js");
        const result = await ch31.getVoteDetail(params.voteId, {
            msgId: params.msgId,
            sessionId: params.sessionId,
        });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachAddVoteChoice = {
    name: "yach_add_vote_choice",
    label: "选择投票答案（写）",
    description: "为投票选择答案选项。write 操作，执行前需用户确认。",
    parameters: Type.Object({
        voteId: Type.String({ description: "投票 id" }),
        choiceIds: Type.Array(Type.String(), { description: "选择的选项 id 数组" }),
        teamId: Type.Optional(Type.String({ description: "群 tid；群投票通常必需" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch31 = require("../../api/ch31-vote/index.js");
        const result = await ch31.addVoteChoice(params.voteId, params.choiceIds, params.teamId);
        return toolResult(`✅ 已选择投票选项\nvoteId=${params.voteId}, 选择: ${params.choiceIds.join(", ")}\n${JSON.stringify(result)}`);
    },
};
export const yachGetVoteCount = {
    name: "yach_get_vote_count",
    label: "投票计数",
    description: "获取投票各选项的计数统计。uniq 从投票消息获取。只读。",
    parameters: Type.Object({
        uniq: Type.String({ description: "投票唯一标识 uniq" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch31 = require("../../api/ch31-vote/index.js");
        const result = await ch31.getIntelloftVoteCount(params.uniq);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachIntelloftVote = {
    name: "yach_intelloft_vote",
    label: "发起投票（写）",
    description: "通过 interlloft 接口发起投票。写操作，执行前需用户确认。",
    parameters: Type.Object({
        to: Type.String({ description: "投票目标（群 tid 或 user.id）" }),
        title: Type.String({ description: "投票标题" }),
        options: Type.Array(Type.String(), { description: "选项文字数组" }),
        multi: Type.Optional(Type.Boolean({ description: "是否多选（可选）" })),
        days: Type.Optional(Type.Integer({ description: "截止天数，默认 1（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch31 = require("../../api/ch31-vote/index.js");
        const result = await ch31.intelloftVote({
            to: params.to,
            title: params.title,
            options: params.options,
            multi: params.multi,
            days: params.days ?? 1,
        });
        return toolResult(`✅ 已发起投票「${params.title}」\nto=${params.to}, 选项: ${params.options.join(", ")}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch21-vote.js.map