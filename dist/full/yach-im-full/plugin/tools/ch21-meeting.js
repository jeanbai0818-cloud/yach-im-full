/**
 * 腾讯会议/音视频工具
 * 对应 API: src/api/ch22-meeting/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetTencentMeetingList = {
    name: "yach_get_tencent_meeting_list",
    label: "查腾讯会议列表",
    description: "查询腾讯会议列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch22-meeting/index.js");
        const result = await ch.getTencentMeetingList({ page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetTencentMeetingInfo = {
    name: "yach_get_tencent_meeting_info",
    label: "查腾讯会议详情",
    description: "查询腾讯会议详情。",
    parameters: Type.Object({
        meetingId: Type.String({ description: "会议 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch22-meeting/index.js");
        const result = await ch.getTencentMeetingInfo(params.meetingId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetTencentMeetingSummary = {
    name: "yach_get_tencent_meeting_summary",
    label: "查会议摘要",
    description: "获取会议文字摘要。",
    parameters: Type.Object({
        meetingId: Type.String({ description: "会议 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch22-meeting/index.js");
        const result = await ch.getTencentMeetingSummary(params.meetingId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetTencentRecordInfo = {
    name: "yach_get_tencent_record_info",
    label: "查腾讯记录信息",
    description: "查询会议录音/录像记录信息。",
    parameters: Type.Object({
        recordId: Type.String({ description: "记录 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch22-meeting/index.js");
        const result = await ch.getTencentRecordInfo(params.recordId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachRefreshTencentToken = {
    name: "yach_refresh_tencent_token",
    label: "刷新腾讯 Token",
    description: "刷新腾讯会议 Token。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const ch = require("../../api/ch22-meeting/index.js");
        const result = await ch.refreshTencentToken();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachLinkMsgAbstract = {
    name: "yach_link_msg_abstract",
    label: "链接消息摘要",
    description: "获取链接消息的摘要预览。",
    parameters: Type.Object({
        url: Type.String({ description: "链接 URL" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch22-meeting/index.js");
        const result = await ch.getLinkMsgAbstract(params.url);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
//# sourceMappingURL=ch21-meeting.js.map