/**
 * 知音楼 Agent 工具集
 *
 * 工具通过 OpenClaw/知音楼服务端能力查询数据，
 * 或者直接调用 ch1-messaging 发消息。
 *
 * 工具列表：
 *   yach_send_message    — 发消息（文本/图片/文件/音视频/图文混排）
 *   yach_get_history     — 查某会话历史消息
 *   yach_list_sessions   — 列出所有会话
 *   yach_search_messages — 全文搜索消息
 *   yach_get_status      — yach-im-full NIM 连接状态
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
// ── 工具工厂 ─────────────────────────────────────────────────
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
export const yachSearchGroups = {
    name: "yach_search_groups",
    label: "搜索知音楼群组",
    description: "搜索知音楼群组，返回群名、群ID、成员数",
    parameters: Type.Object({
        query: Type.String({ description: "群名关键词" }),
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.searchGroup(params.query, { pagesize: params.limit ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/**
 * ch4 - 查询未来N天日程
 */
export const yachGetGroupUsers = {
    name: "yach_get_group_users",
    label: "查知音楼群成员",
    description: "查询某群的成员列表（需已加入该群）。to 传群 tid。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid（网易云信 teamId）" }),
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 50", default: 50, minimum: 1, maximum: 200 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.getGroupUsers(params.tid, { pagesize: params.limit ?? 50 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** ch2 - 群详情（需已加入该群） */
export const yachGetGroupInfo = {
    name: "yach_get_group_info",
    label: "查知音楼群详情",
    description: "查某群的详情（群名/人数/公告等，需已加入该群，否则 40002）。tid 传群 tid。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid（网易云信 teamId）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.getGroupInfo(params.tid);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** ch2 - 话题群/频道内容列表 */
export const yachListSquads = {
    name: "yach_list_squads",
    label: "查知音楼话题群",
    description: "查话题群/频道（squad）内容列表。squadId 是话题群独立 id（非普通群 tid），缺失报 403。",
    parameters: Type.Object({
        squadId: Type.String({ description: "话题群独立 id（必填）" }),
        limit: Type.Optional(Type.Integer({ description: "返回上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.listSquads(params.squadId, { pagesize: params.limit ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** ch2 - 建群（写） */
export const yachCreateGroup = {
    name: "yach_create_group",
    label: "知音楼建群",
    description: "创建群聊。members 为成员 user_id 数组（不含自己，创建者自动加入），至少 1 个对方。写操作，需确认。",
    parameters: Type.Object({
        name: Type.String({ description: "群名" }),
        members: Type.Array(Type.String(), { description: "成员 user_id 数组（不含自己）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.createGroup(params.name, params.members || []);
        return toolResult(`✅ 已建群「${params.name}」\ntid=${result?.tid ?? result?.id ?? "?"}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 群加人（写） */
export const yachAddGroupUsers = {
    name: "yach_add_group_users",
    label: "知音楼群加人",
    description: "向群添加成员。accids 为要加的成员 user_id/accid 数组。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        accids: Type.Array(Type.String(), { description: "要加的成员 accid 数组" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.addGroupUsers(params.tid, params.accids || []);
        return toolResult(`✅ 已向群 ${params.tid} 加入：${(params.accids || []).join(", ")}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 编辑群信息/改群名（写） */
export const yachEditGroupInfo = {
    name: "yach_edit_group_info",
    label: "知音楼改群名",
    description: "编辑群信息（主要改群名）。传 tid + name（新群名）。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        name: Type.String({ description: "新群名" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.editGroupInfo(params.tid, { name: params.name });
        return toolResult(`✅ 已改群 ${params.tid} 群名 → 「${params.name}」\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 踢人（写） */
export const yachRemoveGroupUsers = {
    name: "yach_remove_group_users",
    label: "知音楼群踢人",
    description: "将成员移出群。accids 为要移出的 accid 数组。高破坏性写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        accids: Type.Array(Type.String(), { description: "要移出的成员 accid 数组" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.removeGroupUsers(params.tid, params.accids || []);
        return toolResult(`✅ 已从群 ${params.tid} 移出：${(params.accids || []).join(", ")}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 转让群主（写） */
export const yachChangeGroupOwner = {
    name: "yach_change_group_owner",
    label: "知音楼转让群主",
    description: "将群主转让给新成员。高风险写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        newOwnerAccid: Type.String({ description: "新群主 accid" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.changeGroupOwner(params.tid, params.newOwnerAccid);
        return toolResult(`✅ 群 ${params.tid} 群主已转让 → ${params.newOwnerAccid}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 设/撤管理员（写） */
export const yachSetGroupAdmin = {
    name: "yach_set_group_admin",
    label: "知音楼设管理员",
    description: "设置或取消群管理员。set=true 设置、false 取消。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        accids: Type.Array(Type.String(), { description: "目标成员 accid 数组" }),
        set: Type.Optional(Type.Boolean({ description: "true 设置管理员（默认），false 取消", default: true })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const set = params.set !== false;
        const result = await ch2.setGroupAdmin(params.tid, params.accids || [], set);
        return toolResult(`✅ 群 ${params.tid} ${set ? "设置" : "取消"}管理员：${(params.accids || []).join(", ")}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 全员禁言开关（写） */
export const yachMuteGroup = {
    name: "yach_mute_group",
    label: "知音楼群禁言",
    description: "开启或关闭群全员禁言。mute=true 禁言、false 解除。写操作，需确认。注：禁言状态 capi 层无法反查。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        mute: Type.Optional(Type.Boolean({ description: "true 开启全员禁言（默认），false 解除", default: true })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const mute = params.mute !== false;
        const result = await ch2.muteGroup(params.tid, mute);
        return toolResult(`✅ 群 ${params.tid} 已${mute ? "开启全员禁言" : "解除禁言"}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 退群（写） */
export const yachQuitGroup = {
    name: "yach_quit_group",
    label: "知音楼退群",
    description: "自己退出群聊。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.quitGroup(params.tid);
        return toolResult(`✅ 已退出群 ${params.tid}\n${JSON.stringify(result)}`);
    },
};
/** ch2 - 解散群（写） */
export const yachDismissGroup = {
    name: "yach_dismiss_group",
    label: "知音楼解散群",
    description: "解散（删除）群聊。最高破坏性写操作，只对自己建的群用，必须先确认，绝不误删真实工作群。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch2 = require("../../api/ch2-groups/index.js");
        const result = await ch2.dismissGroup(params.tid);
        return toolResult(`✅ 已解散群 ${params.tid}\n${JSON.stringify(result)}`);
    },
};
/** ch3 - 搜索 AI 助手历史（真调通，95search/search/aide） */
//# sourceMappingURL=ch2-groups.js.map
