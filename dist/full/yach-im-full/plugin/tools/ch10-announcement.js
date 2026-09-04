/**
 * 群公告 CRUD 工具
 * 对应 API: src/api/ch10-announcement/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetGroupAnnouncements = {
    name: "yach_get_group_announcements",
    label: "查群公告列表",
    description: "查询某群的公告列表。tid 传群 tid。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const result = await ch.getGroupAnnouncements(params.tid);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetGroupAnnouncementDetail = {
    name: "yach_get_group_announcement_detail",
    label: "查群公告详情",
    description: "查询群公告详情。tid 和 announcementId 必填。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        announcementId: Type.String({ description: "公告 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const result = await ch.getGroupAnnouncementDetail(params.tid, params.announcementId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachCreateGroupAnnouncement = {
    name: "yach_create_group_announcement",
    label: "新增群公告",
    description: "新建群公告。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        title: Type.String({ description: "公告标题" }),
        content: Type.String({ description: "公告正文" }),
        top: Type.Optional(Type.Integer({ description: "是否置顶 0=否 1=是", default: 0 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const result = await ch.createGroupAnnouncement(params.tid, { title: params.title, content: params.content, top: params.top ?? 0 });
        return toolResult(`✅ 已创建群公告\n${JSON.stringify(result)}`);
    },
};
export const yachUpdateGroupAnnouncement = {
    name: "yach_update_group_announcement",
    label: "编辑群公告",
    description: "编辑群公告。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        announcementId: Type.String({ description: "公告 id" }),
        title: Type.Optional(Type.String({ description: "新标题" })),
        content: Type.Optional(Type.String({ description: "新正文" })),
        top: Type.Optional(Type.Integer({ description: "是否置顶 0=否 1=是" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const result = await ch.updateGroupAnnouncement(params.tid, params.announcementId, { title: params.title, content: params.content, top: params.top });
        return toolResult(`✅ 已更新群公告\n${JSON.stringify(result)}`);
    },
};
export const yachDeleteGroupAnnouncement = {
    name: "yach_delete_group_announcement",
    label: "删除群公告",
    description: "删除群公告。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        announcementId: Type.String({ description: "公告 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const result = await ch.deleteGroupAnnouncement(params.tid, params.announcementId);
        return toolResult(`✅ 已删除群公告 ${params.announcementId}\n${JSON.stringify(result)}`);
    },
};
export const yachSetGroupAnnouncementTop = {
    name: "yach_set_group_announcement_top",
    label: "群公告置顶",
    description: "置顶/取消置顶群公告。写操作，需确认。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        announcementId: Type.String({ description: "公告 id" }),
        top: Type.Optional(Type.Boolean({ description: "true=置顶, false=取消置顶", default: true })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const top = params.top !== false;
        const result = await ch.setGroupAnnouncementTop(params.tid, params.announcementId, top ? 1 : 0);
        return toolResult(`✅ 已${top ? "置顶" : "取消置顶"}群公告\n${JSON.stringify(result)}`);
    },
};
export const yachGetGroupAnnouncementCheck = {
    name: "yach_get_group_announcement_check",
    label: "查群公告阅读状态",
    description: "查看谁读了群公告。",
    parameters: Type.Object({
        tid: Type.String({ description: "群 tid" }),
        announcementId: Type.String({ description: "公告 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch10-announcement/index.js");
        const result = await ch.getGroupAnnouncementCheck(params.tid, params.announcementId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
//# sourceMappingURL=ch10-announcement.js.map