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
 *   yach_get_status      — daemon 连接状态
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
export const yachListReminders = {
    name: "yach_list_reminders",
    label: "知音楼通知提醒",
    description: "获取知音楼通知/提醒列表",
    parameters: Type.Object({
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch8 = require("../../api/ch8-notify/index.js");
        const result = await ch8.getRemindList({ pagesize: params.limit ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** ch8 - 确认/已读一条提醒（写操作）*/
export const yachConfirmRemind = {
    name: "yach_confirm_remind",
    label: "确认提醒",
    description: "确认/标已读一条提醒（bsvr/remind/feed/confirm）。feedId 从 yach_list_reminders 返回的 feed_id 取。写操作。",
    parameters: Type.Object({
        feedId: Type.String({ description: "提醒 feed_id（来自 yach_list_reminders）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch8 = require("../../api/ch8-notify/index.js");
        await ch8.confirmRemind(params.feedId);
        return toolResult(`✅ 已确认提醒 ${params.feedId}`);
    },
};
/** ch8 - 撤回我发的提醒（写操作）*/
export const yachRecallRemind = {
    name: "yach_recall_remind",
    label: "撤回提醒",
    description: "撤回我发出的提醒（bsvr/remind/feed/revoke）。rid 从发提醒的返回值或提醒列表取。写操作。",
    parameters: Type.Object({
        rid: Type.String({ description: "提醒 rid" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch8 = require("../../api/ch8-notify/index.js");
        await ch8.recallRemind(params.rid);
        return toolResult(`✅ 已撤回提醒 ${params.rid}`);
    },
};
/**
 * ch9 - 搜索用户
 */
export const yachSendRemind = {
    name: "yach_send_remind",
    label: "知音楼发送提醒",
    description: "给指定人发知音楼提醒（知音楼自带新建提醒能力）。" +
        "remindType: \"0\"应用内提醒(默认) / \"1\"短信提醒 / \"2\"电话提醒。" +
        "电话提醒会真实拨打接收人手机，谨慎使用。需 daemon 运行/已登录。",
    parameters: Type.Object({
        content: Type.String({ description: "提醒内容（≤1000 字）" }),
        uids: Type.Array(Type.String(), { description: "接收人 user.id 数组" }),
        remindType: Type.Optional(Type.String({ description: "\"0\"应用内 / \"1\"短信 / \"2\"电话，默认 \"0\"", default: "0" })),
        msgId: Type.Optional(Type.String({ description: "关联消息 id（可选，对某条消息发提醒）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch8 = require("../../api/ch8-notify/index.js");
        const r = await ch8.createRemind({
            content: params.content,
            uids: params.uids,
            remindType: params.remindType ?? "0",
            msgId: params.msgId,
        });
        const typeName = { "0": "应用内", "1": "短信", "2": "电话" }[String(params.remindType ?? "0")] || "应用内";
        return toolResult(`✅ 已发${typeName}提醒给 ${(params.uids || []).join(", ")}\nrid=${r?.id ?? "?"}\n内容：${params.content}`);
    },
};
/** ch7 - ⭐ 周报已读人列表（真调验证：字段 name/workCode/at，2026-07-13）*/
export const yachGetRemindQuota = {
    name: "yach_get_remind_quota",
    label: "提醒配额",
    description: "查询我当前剩余的提醒发送配额（bsvr/remind/user/quota），含应用内/短信/电话条数。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch8 = require("../../api/ch8-notify/index.js");
        const r = await ch8.getRemindQuota();
        const q = r || {};
        return toolResult(`📊 提醒配额剩余：\n  应用内消息：${q.message ?? "?"} 条\n  电话提醒：${q.phone ?? "?"} 条`);
    },
};
/** ch8 - 提示栏活动通知（正在进行的会议/直播，2026-07-21）*/
export const yachGetPromptBar = {
    name: "yach_get_prompt_bar",
    label: "活动提示栏",
    description: "获取顶部提示栏消息：正在进行中的会议（meeting_list）和直播（living_list）横幅通知。" +
        "接口：GET bsvr/promptBarMsg/list。total=0 表示当前无进行中会议/直播。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch8 = require("../../api/ch8-notify/index.js");
        const r = await ch8.getPromptBar();
        if (r.total === 0)
            return toolResult("✅ 当前无正在进行的会议或直播");
        const lines = [`共 ${r.total} 条活动提示：`];
        for (const m of r.meeting_list || []) {
            lines.push(`🎯 会议: ${m.title || m.name || JSON.stringify(m)}`);
        }
        for (const l of r.living_list || []) {
            lines.push(`📺 直播: ${l.title || l.name || JSON.stringify(l)}`);
        }
        return toolResult(lines.join("\n"));
    },
};
/** ch9 - ⭐ 设置个人状态/签名（写操作，需确认）*/
//# sourceMappingURL=ch8-notify.js.map