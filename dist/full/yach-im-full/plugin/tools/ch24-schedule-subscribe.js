/**
 * 日程订阅 / ICS 日历工具
 * 对应 API: src/api/ch30-schedule-subscribe/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetScheduleSubscriptionSettings = {
    name: "yach_get_schedule_subscription_settings",
    label: "查日程订阅设置",
    description: "按 permission 查询日程订阅设置；该参数是查询条件，不代表修改。",
    parameters: Type.Object({
        permission: Type.Union([Type.Literal(0), Type.Literal(1), Type.Literal(2)], {
            description: "权限条件：0=关闭，1=开启，2=部分",
        }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.getScheduleSubscriptionSettings(params.permission);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetScheduleSubscriptionSubscribers = {
    name: "yach_get_schedule_subscription_subscribers",
    label: "查日程订阅者",
    description: "查询日程订阅者列表。",
    parameters: Type.Object({
        scheduleId: Type.String({ description: "日程 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.getScheduleSubscriptionSubscribers(params.scheduleId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachAddScheduleShareIcs = {
    name: "yach_add_schedule_share_ics",
    label: "添加 ICS 日历",
    description: "添加 ICS 日历订阅。写操作，需确认。",
    parameters: Type.Object({
        url: Type.String({ description: "ICS URL" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.addScheduleShareIcs(params.url);
        return toolResult(`✅ 已添加 ICS 日历\n${JSON.stringify(result)}`);
    },
};
export const yachDeleteScheduleShareIcs = {
    name: "yach_delete_schedule_share_ics",
    label: "删除 ICS 日历",
    description: "删除 ICS 日历订阅。写操作，需确认。",
    parameters: Type.Object({
        icsId: Type.String({ description: "ICS id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.deleteScheduleShareIcs(params.icsId);
        return toolResult(`✅ 已删除 ICS 日历\n${JSON.stringify(result)}`);
    },
};
export const yachGetScheduleShareIcsList = {
    name: "yach_get_schedule_share_ics_list",
    label: "查 ICS 列表",
    description: "查询已订阅的 ICS 日历列表。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.getScheduleShareIcsList();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachEditScheduleShareIcs = {
    name: "yach_edit_schedule_share_ics",
    label: "编辑 ICS 日历",
    description: "编辑 ICS 日历信息。写操作，需确认。",
    parameters: Type.Object({
        icsId: Type.String({ description: "ICS id" }),
        url: Type.Optional(Type.String({ description: "新 URL" })),
        name: Type.Optional(Type.String({ description: "新名称" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.editScheduleShareIcs({ ics_id: params.icsId, url: params.url, name: params.name });
        return toolResult(`✅ 已编辑 ICS 日历\n${JSON.stringify(result)}`);
    },
};
export const yachSyncScheduleShareIcs = {
    name: "yach_sync_schedule_share_ics",
    label: "同步 ICS 日历",
    description: "手动同步 ICS 日历。写操作，需确认。",
    parameters: Type.Object({
        icsId: Type.String({ description: "ICS id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.syncScheduleShareIcs(params.icsId);
        return toolResult(`✅ 已同步 ICS 日历\n${JSON.stringify(result)}`);
    },
};
export const yachCancelScheduleShare = {
    name: "yach_cancel_schedule_share",
    label: "取消日程分享",
    description: "取消日程分享。写操作，需确认。",
    parameters: Type.Object({
        shareId: Type.String({ description: "分享 id" }),
        uid: Type.String({ description: "需要取消分享的顶层 user.id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch30-schedule-subscribe/index.js");
        const result = await ch.cancelScheduleShare(params.shareId, params.uid);
        return toolResult(`✅ 已取消日程分享\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch24-schedule-subscribe.js.map