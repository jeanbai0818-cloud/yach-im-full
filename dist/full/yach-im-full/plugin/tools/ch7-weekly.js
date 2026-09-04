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
function writeToolResult(text) {
    return toolResult(`${text}\n操作已经执行，必须向用户明确回复本次结果；不得返回 NO_REPLY，也不得为同一请求再次执行。`);
}
// ── 工具工厂 ─────────────────────────────────────────────────
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
export const yachListWeekly = {
    name: "yach_list_weekly",
    label: "列周报",
    description: "列出我发出的周报（含周次/读赞数/分段标题，关联 OKR）。⚠️ 服务端固定只返回最近约 10 篇，不支持翻页。想看别人发给我的用 yach_list_received_weekly。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listSentWeekly();
        const lines = r.list.map((w) => `• [${w.logId}] ${w.templateName} ${w.weekStart} | 读${w.readCount} 赞${w.starCount}`);
        return toolResult(`返回 ${r.returned} 篇（${r.note}）\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch7 - ⭐ 我接收的周报（他人发给我的）—— 真调验证 2026-07-13 */
export const yachListReceivedWeekly = {
    name: "yach_list_received_weekly",
    label: "列我接收的周报",
    description: "列出别人发给我的周报（不是我自己发的）。含发报人 id/周次/读赞数/正文分段。返回的 logId 可用于 yach_get_weekly_detail 看详情、yach_zan_weekly 点赞。⚠️ 服务端固定只返回最近约 10 篇，不支持翻页。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listReceivedWeekly();
        const lines = r.list.map((w) => `• [${w.logId}] ${w.templateName} ${w.weekStart} | 发报人 uid ${w.senderUserId} | 读${w.readCount} 赞${w.starCount}`);
        return toolResult(`我接收的周报：返回 ${r.returned} 篇（${r.note}）\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch7 - ⭐ 我的周报收到的互动动态（谁点赞/评论了）—— 真调验证 2026-07-13 */
export const yachListWeeklyEvents = {
    name: "yach_list_weekly_events",
    label: "周报互动动态",
    description: "列出我发的周报都被谁点赞/评论了（互动时间线）。含操作人/动作类型/时间/对应周报 logId 与摘要。⚠️ 服务端一次全返，不支持翻页。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listWeeklyEvents();
        const lines = r.list.map((e) => `• ${e.at} ${e.actor} ${e.action}了「${e.summary}」 [${e.logId}]`);
        return toolResult(`周报互动：返回 ${r.returned} 条（${r.note}）\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch7 - 周报周期列表（真调验证 2026-07-13） */
export const yachListWeeklyWeeks = {
    name: "yach_list_weekly_weeks",
    label: "周报周期列表",
    description: "列出周报可选的周期（每周的起止时间），用于确定“看哪一周”。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const list = await ch7.listWeeklyWeeks();
        const lines = list.map((w) => `• ${w.start} ~ ${w.end}`);
        return toolResult(`周报周期（${list.length}）\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch7 - ⭐ 周报模板类型（真调验证 2026-07-13）*/
export const yachListWeeklyTemplates = {
    name: "yach_list_weekly_templates",
    label: "周报模板类型",
    description: "列出周报可选模板类型及当前选中项（2=普通周报 / 3=OKR周报 / 6=复盘周报），写周报前确定 template_type 用。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listWeeklyTemplates();
        const lines = r.list.map((t) => `• ${t.title}（type=${t.type}）${String(t.type) === String(r.selected) ? " ← 当前选中" : ""}`);
        return toolResult(`周报模板（当前选中 type=${r.selected}）\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch7 - ⭐ 读周报草稿（真调验证 2026-07-13）*/
export const yachGetWeeklyDraft = {
    name: "yach_get_weekly_draft",
    label: "读周报草稿",
    description: "读当前周报草稿（指定 templateType：2普通/3OKR/6复盘）。当 type=3 时自动读取当前季度完整 OKR，合并草稿并补出空 KR 段；同时按服务端 isHi 明确标注哪些 KR 已在周报界面勾选、哪些只是未选的完整框架。不能把“有历史内容”误判为“已勾选显示”。只读。",
    parameters: Type.Object({
        templateType: Type.Optional(Type.String({ description: "模板类型 2/3/6，不传取默认" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const d = await ch7.getWeeklyDraft(params.templateType);
        const parts = [
            `草稿 | ${d.templateName}(type=${d.templateType}) | 周 ${d.weekStart} | 更新 ${d.updatedAt}`,
            `draftRevision: ${d.draftRevision}（保存时必须原样传回；草稿变化后需重新读取）`,
        ];
        if (d.okrStructureSynced) {
            parts.push(`完整 OKR 框架 | ${d.objectiveCount} O / ${d.krCount} 个唯一 KR` +
                ` | 当前 KR 段 ${d.currentKrSectionCount} 个（每个 KR 固定为“本周完成+下周计划”2段）` +
                ` | 非 OKR 段 ${d.nonOkrSectionCount} 个` +
                ` | 已勾选显示 ${d.selectedKrCount} 个 KR: ${d.selectedKrIds.join(", ") || "(无)"}` +
                ` | 未勾选隐藏 ${d.hiddenKrCount} 个 KR: ${d.hiddenKrIds.join(", ") || "(无)"}` +
                `${d.addedKrIds.length ? ` | 草稿原先缺少、现已补空段的 KR: ${d.addedKrIds.join(", ")}` : " | 草稿已覆盖全部当前 KR"}` +
                `${d.staleKrIds.length ? ` | 历史 KR（不计入当前框架）: ${d.staleKrIds.join(", ")}` : ""}`);
        }
        d.sections.forEach((s, i) => {
            parts.push(`\n【${i + 1}. ${s.title}】` +
                `${s.okrStatus === "current" ? " [当前OKR]" : s.okrStatus === "stale" ? " [历史KR，不计入当前框架]" : ""}` +
                `${s.okrStatus === "current" ? (s.selectedInWeekly ? " [已勾选显示]" : " [未勾选，仅完整框架]") : ""}` +
                `${s.krId ? ` [oId=${s.oId}, krId=${s.krId}]` : ""}` +
                `${s.okrTitle ? " (" + s.okrTitle + ")" : ""}\n${s.content || "(空)"}`);
        });
        if (d.receiveUserIds.length)
            parts.push(`\n收件人: ${d.receiveUserIds.join(", ")}`);
        if (d.receiveGroupIds.length)
            parts.push(`\n收件群: ${d.receiveGroupIds.join(", ")}`);
        return toolResult(parts.join("\n"));
    },
};
/** ch7 - ⭐ 上次发送的周报（真调验证 2026-07-13）*/
export const yachGetLastSentWeekly = {
    name: "yach_get_last_sent_weekly",
    label: "上次发的周报",
    description: "取上次发送的周报（指定 templateType：2普通/3OKR/6复盘），带完整各段正文，用于“参考上次”起草本周周报。只读。",
    parameters: Type.Object({
        templateType: Type.Optional(Type.String({ description: "模板类型 2/3/6，不传取默认" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const d = await ch7.getLastSentWeekly(params.templateType);
        const parts = [`上次周报 | ${d.templateName}(type=${d.templateType}) | 发于 ${d.createdAt}`];
        d.sections.forEach((s, i) => {
            parts.push(`\n【${i + 1}. ${s.title}】${s.okrTitle ? " (" + s.okrTitle + ")" : ""}\n${s.content || "(空)"}`);
        });
        return toolResult(parts.join("\n"));
    },
};
/** ch7 - ⭐ 当前周期时间（真调验证 2026-07-13）*/
export const yachGetWeeklyTime = {
    name: "yach_get_weekly_time",
    label: "周报当前时间",
    description: "取周报系统当前周期时间（服务端时钟）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.getWeeklyTime();
        return toolResult(`周报当前时间：${r.time}`);
    },
};
/** ch7 - ⭐ 上报对象列表（真调验证 2026-07-13）*/
export const yachListReportEmployees = {
    name: "yach_list_report_employees",
    label: "周报上报对象",
    description: "列出周报的上报对象（我该把周报发给谁），含姓名/工号/部门/userId。发送周报时取这些 userId 填 receive_user_ids。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listReportEmployees();
        const lines = r.list.map((u) => `• ${u.name}（${u.workCode}，id=${u.userId}）${u.dept ? " — " + u.dept : ""}`);
        return toolResult(`上报对象（${r.list.length}）\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch7 - ⭐⭐ 按指定人查周报（真分页，真调验证 2026-07-13）*/
export const yachSearchUserWeekly = {
    name: "yach_search_user_weekly",
    label: "查他人周报",
    description: "按指定人查其周报（mgo/log/filtersearch）。⭐与 yach_list_received_weekly 不同：能看**任意指定人**且**真分页**（可翻完全部历史，非 10 篇天花板）。userIds 先用 yach_search_users 搜人拿。需有查看权限（可先用 yach_check_weekly_authority）。发报人仅返 userId。只读。",
    parameters: Type.Object({
        userIds: Type.Array(Type.String(), { description: "目标用户 id 数组（来自 yach_search_users）" }),
        page: Type.Optional(Type.Number({ description: "页码，默认 1（真分页）" })),
        size: Type.Optional(Type.Number({ description: "每页条数，默认 10，最大 50" })),
        unReadOnly: Type.Optional(Type.Boolean({ description: "仅未读，默认 false" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.searchUserWeekly(params.userIds, params.page || 1, params.size || 10, params.unReadOnly ? 1 : 0);
        const lines = r.list.map((w) => `• [${w.logId}] ${w.templateName} | 周 ${w.weekStart} | 发报人 uid=${w.senderUserId} | 读${w.readCount} 赞${w.starCount}`);
        return toolResult(`他人周报：common=${r.total} 总数，第 ${r.page} 页返 ${r.returned} 篇（${r.note}）\n${lines.join("\n") || "(空——可能无权限或该人无周报)"}`);
    },
};
/** ch7 - ⭐ 周报查看权限校验（真调验证 2026-07-13）*/
export const yachCheckWeeklyAuthority = {
    name: "yach_check_weekly_authority",
    label: "周报查看权限",
    description: "校验我对指定人的周报有无查看权限（mgo/log/apply）。返回有权限/无权限名单。查他人周报前先校验，避免搞不清“返空”是无权限还是真没周报。只读。",
    parameters: Type.Object({
        userIds: Type.Array(Type.String(), { description: "目标用户 id 数组" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.checkWeeklyAuthority(params.userIds);
        const a = r.authorized.map((u) => `${u.name || u.userId}`).join(", ") || "(无)";
        const u = r.unauthorized.map((x) => `${x.name || x.userId}`).join(", ") || "(无)";
        return toolResult(`周报查看权限：\n✅有权限: ${a}\n⛔无权限: ${u}`);
    },
};
/** ch7 - ⭐ 给周报评论（写操作，需确认）*/
export const yachCommentWeekly = {
    name: "yach_comment_weekly",
    label: "评论周报",
    description: "给一篇周报写评论（mgo/log/comment/add）。真写操作：对方会看到评论并收到提醒。logId 从周报列表/详情获取。可选 replyToId/replyToName 回复某条评论。对外写操作，调用前需用户确认。",
    parameters: Type.Object({
        logId: Type.String({ description: "周报 log_id" }),
        comment: Type.String({ description: "评论内容" }),
        replyToId: Type.Optional(Type.String({ description: "回复目标评论的 remake_id（来自 yach_get_weekly_comments 的 commentId，非 user_id）" })),
        replyToName: Type.Optional(Type.String({ description: "回复目标评论人姓名（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.commentWeekly(params.logId, params.comment, { replyToId: params.replyToId, replyToName: params.replyToName });
        return writeToolResult(`✅ 已评论周报 ${r.logId}：“${params.comment}”\n` +
            `commentId：${r.commentId ?? "（服务端未返回且列表回读未解析到；写入已成功，请勿重试）"}`);
    },
};
/** ch7 - ⭐ 删除周报评论（写操作，需确认）*/
export const yachDeleteWeeklyComment = {
    name: "yach_delete_weekly_comment",
    label: "删除周报评论",
    description: "删除自己在某周报下的评论（mgo/log/delcomment）。commentId 从 yach_get_weekly_comments 返回的 commentId 取。只能删自己的评论。对外写操作，调用前需用户确认。",
    parameters: Type.Object({
        logId: Type.String({ description: "周报 log_id" }),
        commentId: Type.Union([Type.String(), Type.Number()], { description: "评论 id（来自 yach_get_weekly_comments 的 commentId）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.deleteWeeklyComment(params.logId, params.commentId);
        return writeToolResult(`✅ 已删除评论 ${r.commentId}（周报 ${r.logId}）`);
    },
};
/** ch7 - ⭐ 上报对象分类（只读）*/
export const yachListReportCategory = {
    name: "yach_list_report_category",
    label: "周报上报对象分类",
    description: "列出周报上报对象的分类（mgo/log/report/category）：上级/同级/我的上报对象/默认收件人。比 yach_list_report_employees 更全，适合选收件人时看分类。只读。",
    parameters: Type.Object({}),
    async execute(_id) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listReportCategory();
        const fmt = (arr) => arr.map((u) => `${u.name}(${u.workCode || u.userId})`).join(", ") || "(无)";
        return toolResult(`上报对象分类：\n• 上级: ${fmt(r.higher)}\n• 同级: ${fmt(r.sameLevel)}\n• 我的上报对象: ${fmt(r.myReport)}\n• 默认收件人: ${fmt(r.defaultReceive)}`);
    },
};
/** ch7 - ⭐ 标记周报已读（写操作，轻量）*/
export const yachMarkWeeklyRead = {
    name: "yach_mark_weekly_read",
    label: "标记周报已读",
    description: "把一篇周报标为已读（mgo/log/readed）。看完别人周报后标已读，对方能在已读名单看到。logId 从周报列表/详情获取。轻量写操作。",
    parameters: Type.Object({
        logId: Type.String({ description: "周报 log_id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.markWeeklyRead(params.logId);
        return writeToolResult(`✅ 已标记周报 ${r.logId} 为已读`);
    },
};
/** ch7 - ⭐ 关注某人周报（写操作，需确认）*/
export const yachFollowUserWeekly = {
    name: "yach_follow_user_weekly",
    label: "关注他人周报",
    description: "关注某人的周报（mgo/log/userfans），关注后其周报会进关注流。userId 先用 yach_search_users 搜人拿。真写操作，调用前需用户确认。取消用 yach_unfollow_user_weekly。",
    parameters: Type.Object({
        userId: Type.String({ description: "要关注的用户 id（来自 yach_search_users）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.followUserWeekly(params.userId);
        return writeToolResult(`✅ 已关注用户 ${r.userId} 的周报${r.num ? `（关注数 ${r.num}）` : ""}`);
    },
};
/** ch7 - ⭐ 取消关注（写操作，需确认）*/
export const yachUnfollowUserWeekly = {
    name: "yach_unfollow_user_weekly",
    label: "取消关注他人周报",
    description: "取消关注某人的周报（mgo/log/cancelfans）。与 yach_follow_user_weekly 配对。真写操作，调用前需用户确认。",
    parameters: Type.Object({
        userId: Type.String({ description: "要取消关注的用户 id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.unfollowUserWeekly(params.userId);
        return writeToolResult(`✅ 已取消关注用户 ${r.userId} 的周报`);
    },
};
/** ch7 - ⭐ 存草稿/发送周报（写操作，需确认）*/
export const yachSaveWeeklyDraft = {
    name: "yach_save_weekly_draft",
    label: "保存周报草稿（写）",
    description: "仅安全更新周报草稿，绝不发送。必须先调用 yach_get_weekly_draft，并原样传回 draftRevision；插件会再次读取并校验草稿未变化。" +
        "OKR周报自动刷新当前 OKR/KR 并补齐缺失段，只修改指定内容，保存后读回校验。" +
        "没有证据支持的 KR 必须省略，禁止填写“无进展/待规划/暂无”等占位文字；清除旧内容需明确传空字符串。" +
        "公开工具不支持、禁止使用完整 body 覆盖，只允许 sectionUpdates 局部更新。" +
        "无法取得最新 OKR 时拒绝保存。发送必须另用 yach_prepare_weekly_send + yach_submit_weekly。",
    parameters: Type.Object({
        templateType: Type.String({ description: "必须明确指定：2普通/3OKR/6复盘；写OKR周报必须为3" }),
        draftRevision: Type.String({ description: "刚刚调用 yach_get_weekly_draft 返回的 draftRevision；不可猜测或复用旧值" }),
        sectionUpdates: Type.Array(Type.Object({
            title: Type.Optional(Type.String({ description: "按完整段落标题匹配，例如 心得（好的经验分享给别人）" })),
            krId: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "按 KR id 匹配" })),
            period: Type.Optional(Type.Union([Type.Literal("current"), Type.Literal("next")], { description: "KR 段：current本周完成/next下周计划" })),
            content: Type.String({ description: "有事实依据的纯文本内容；无进展模块不要传，传空字符串表示明确删除旧内容" }),
            contentFull: Type.Optional(Type.String({ description: "可选 HTML；不传则由纯文本安全生成" })),
            includeKr: Type.Optional(Type.Boolean({ description: "仅 KR 段有效：true 勾选并显示该 KR，false 清除后取消勾选；非空内容默认 true" })),
        }), { description: "只修改这些段，其他结构和内容保持不变", minItems: 1 }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const input = {
            templateType: params.templateType,
            draftRevision: params.draftRevision,
            sectionUpdates: params.sectionUpdates,
            syncOkr: true,
        };
        const r = await ch7.saveWeeklyDraft(input);
        const notes = [
            `周报${r.action}成功（type=${r.templateType}，仅存草稿，未发送）。`,
            r.verified ? "✅ 已读回校验内容一致。" : "",
            r.draftRevision ? `最新 draftRevision: ${r.draftRevision}` : "",
            r.applied?.length ? `已更新：${r.applied.map((x) => x.title).join("、")}` : "",
            r.applied?.some((x) => x.krSelected === true)
                ? `已勾选显示 KR：${[...new Set(r.applied.filter((x) => x.krSelected === true).map((x) => x.krId))].join(", ")}`
                : "",
            r.applied?.some((x) => x.krSelected === false)
                ? `已取消勾选 KR：${[...new Set(r.applied.filter((x) => x.krSelected === false).map((x) => x.krId))].join(", ")}`
                : "",
            r.currentKrIds?.length ? `当前 KR：${r.currentKrIds.join(", ")}` : "",
            r.staleKrIds?.length ? `⚠️ 草稿中仍保留非当前 KR：${r.staleKrIds.join(", ")}` : "",
        ].filter(Boolean);
        return writeToolResult(notes.join("\n"));
    },
};
/** ch7 - 周报发送准备（只读，不发送） */
export const yachPrepareWeeklySend = {
    name: "yach_prepare_weekly_send",
    label: "准备发送周报（只读）",
    description: "只读准备周报提交：锁定当前草稿版本、收件配置和最近已发送基线，生成10分钟有效的一次性 sendToken。" +
        "本工具不会保存、修改或发送。必须先让用户审阅当前草稿，并取得对本次发送的明确确认。",
    parameters: Type.Object({
        templateType: Type.String({ description: "模板类型：2普通/3OKR/6复盘" }),
        draftRevision: Type.String({ description: "刚读取并经用户确认的 draftRevision" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.prepareWeeklySend(params.templateType, params.draftRevision);
        return toolResult(`周报发送准备完成，但尚未发送。\n` +
            `sendToken: ${r.sendToken}\n有效期至: ${r.expiresAt}\n` +
            `草稿版本: ${r.draftRevision}\n` +
            `直接收件人: ${r.recipientUserIds.join(", ") || "(按服务端默认规则)"}\n` +
            `接收群: ${r.recipientGroupIds.join(", ") || "(无)"}\n` +
            `只有用户明确确认本次发送后，才能将此 token 交给 yach_submit_weekly。`);
    },
};
/** ch7 - 真正提交周报（不可逆，一次性） */
export const yachSubmitWeekly = {
    name: "yach_submit_weekly",
    label: "提交发送周报（高风险写）",
    description: "严格复现桌面端两阶段发送：先通过 mgo/log/detail/save 创建周报，再通过 mgo/log/send/weekly/share 向全部接收群推送通知。不可撤回、不可测试调用。" +
        "必须使用 yach_prepare_weekly_send 刚生成的一次性 sendToken，并取得用户对本次提交的明确确认。" +
        "同一 token 重试不会再次发送；网络结果不确定时会锁死 token，禁止盲目重试。",
    parameters: Type.Object({
        sendToken: Type.String({ description: "yach_prepare_weekly_send 返回的10分钟一次性令牌" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.submitWeekly(params.sendToken);
        return writeToolResult(r.duplicatePrevented
            ? `✅ 此令牌对应的周报此前已提交，已阻止重复发送。weeklyId: ${r.weeklyId}`
            : `✅ 周报已由真实提交接口发送。weeklyId: ${r.weeklyId}\n` +
                `${r.verified ? "✅ 已通过“上次已发送周报”读回核验。" : "⚠️ 已取得 weekly_id，但已发送列表读回尚未同步；禁止重试发送。"}\n` +
                `${r.groupNotification?.required
                    ? `✅ 已向 ${r.groupNotification.groupCount} 个接收群完成周报通知。`
                    : "ℹ️ 本次无需群通知。"}\n` +
                `直接收件人数: ${r.recipientUserCount ?? 0}`);
    },
};
/** ch7 - 周报详情（真调）*/
export const yachGetWeeklyDetail = {
    name: "yach_get_weekly_detail",
    label: "周报详情",
    description: "读单篇周报详情（完整正文各分段 + 收件人/已读人/评论）。logId 从 yach_list_weekly 获取。只读。",
    parameters: Type.Object({
        logId: Type.String({ description: "周报 log_id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const d = await ch7.getWeeklyDetail(params.logId);
        const parts = [`${d.senderName} | ${d.templateName} | 周 ${d.weekStart} | 读${d.readCount} 赞${d.starCount}`];
        d.sections.forEach((s) => {
            if (!s.content)
                return;
            parts.push(`\n【${s.title}】${s.okrTitle ? " (" + s.okrTitle + ")" : ""}\n${s.content}`);
        });
        if (d.starUsers.length)
            parts.push(`\n点赞: ${d.starUsers.join(", ")}`);
        if (d.readers.length)
            parts.push(`\n已读: ${d.readers.join(", ")}${d._peopleFromSendList ? "" : "（⚠️ 超出最近10篇，名单回退自 detail，可能不准）"}`);
        if (d.remarks.length)
            parts.push(`\n评论: ${d.remarks.map((r) => r.user + ": " + r.content).join(" | ")}`);
        return toolResult(parts.join("\n"));
    },
};
/** ch7 - 给周报点赞（写操作）*/
export const yachZanWeekly = {
    name: "yach_zan_weekly",
    label: "周报点赞",
    description: "给一篇周报点赞（写操作）。幂等（重复调不重复计数）；取消用 yach_cancel_weekly_zan。logId 从 yach_list_weekly / yach_list_received_weekly 获取。只能点你能看到的周报。对外写操作，调用前需用户确认。",
    parameters: Type.Object({
        logId: Type.String({ description: "周报 log_id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.zanWeekly(params.logId);
        return writeToolResult(`✅ 已点赞周报 [${r.logId}]${r.zanCount ? "，当前赞数 " + r.zanCount : ""}。`);
    },
};
/** ch7 - ⭐ 取消周报点赞（写，真调验证 cancelzan→200）*/
export const yachCancelWeeklyZan = {
    name: "yach_cancel_weekly_zan",
    label: "取消周报点赞",
    description: "取消对一篇周报的点赞（与 yach_zan_weekly 配对）。logId 从周报列表获取。对外写操作，调用前需用户确认。",
    parameters: Type.Object({ logId: Type.String({ description: "周报 log_id" }) }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        await ch7.cancelZanWeekly(params.logId);
        return writeToolResult(`✅ 已取消周报点赞 [${params.logId}]。`);
    },
};
/** ch7 - 某周报点赞人列表（读，真调验证）*/
export const yachGetWeeklyZanList = {
    name: "yach_get_weekly_zan_list",
    label: "周报点赞人",
    description: "查看一篇周报都被谁点赞了（返回点赞人 id+姓名）。logId 从周报列表获取。只读。",
    parameters: Type.Object({ logId: Type.String({ description: "周报 log_id" }) }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const users = await ch7.getWeeklyZanUsers(params.logId);
        return toolResult(`点赞人（${users.length}）\n` + (users.map((u) => `• ${u.name} (${u.userId})`).join("\n") || "(无)"));
    },
};
/** ch7 - 某周报评论列表（读）*/
export const yachGetWeeklyComments = {
    name: "yach_get_weekly_comments",
    label: "周报评论",
    description: "查看一篇周报的评论列表，逐条返回删除或回复所需的 commentId（服务端 remake_id）。logId 从周报列表获取。只读。",
    parameters: Type.Object({ logId: Type.String({ description: "周报 log_id" }) }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const cs = await ch7.getWeeklyComments(params.logId);
        return toolResult(`评论（${cs.length}）\n` +
            (cs.map((c) => `• commentId=${c.commentId ?? "（缺失）"} | ${c.at} ${c.name}: ${c.content}`).join("\n") || "(无)"));
    },
};
/** ch7 - ⭐ 批量查多篇周报点赞/已读状态（读，真调验证 readzan/list）*/
export const yachGetWeeklyZanReadBatch = {
    name: "yach_get_weekly_zan_read_batch",
    label: "批量查周报点赞已读",
    description: "一次批量查多篇周报的点赞人+已读人明细（比逐篇查高效，适合“批量判断我是否已赞”去重）。传 logIds 数组。只读。",
    parameters: Type.Object({
        logIds: Type.Array(Type.String(), { description: "周报 log_id 数组" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const rows = await ch7.getWeeklyZanReadBatch(params.logIds);
        const lines = rows.map((r) => `• [${r.logId}] 赞${r.zanCount} 读${r.readCount}`);
        return toolResult(`批量查 ${rows.length} 篇\n${lines.join("\n")}`);
    },
};
/** ch7 - 未读周报列表（读）*/
export const yachListUnreadWeekly = {
    name: "yach_list_unread_weekly",
    label: "未读周报",
    description: "列出我还没读的周报。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listUnreadWeekly();
        const lines = r.list.map((w) => `• [${w.logId}] ${w.templateName} ${w.weekStart}`);
        return toolResult(`未读周报：${r.returned} 篇\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch9 - 用户名片（个人卡片完整数据，真调）*/
export const yachGetWeeklyReaders = {
    name: "yach_get_weekly_readers",
    label: "周报已读人列表",
    description: "查看一篇周报都被谁读过了（mgo/log/readed/list）。logId 从周报列表/详情获取。只读。",
    parameters: Type.Object({
        logId: Type.String({ description: "周报 log_id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.getWeeklyReaders(params.logId);
        const list = Array.isArray(r) ? r : (r.list || r.obj || []);
        if (!list.length)
            return toolResult("暂无人已读。");
        const lines = [`📖 已读人列表（共 ${list.length} 人）：`];
        for (const u of list) {
            const at = u.at ? new Date(Number(u.at) > 1e10 ? Number(u.at) : Number(u.at) * 1000).toLocaleString("zh-CN") : "";
            lines.push(`  ${u.name || u.user_name}（${u.workCode || u.work_code || ""}）${at ? " @" + at : ""}`);
        }
        return toolResult(lines.join("\n"));
    },
};
/** ch7 - ⭐ 我收藏的周报列表（mystarlist，无参，true-tested 2026-07-13）*/
export const yachListStarWeekly = {
    name: "yach_list_star_weekly",
    label: "我收藏的周报",
    description: "列出我收藏（关注）的周报列表（mgo/log/mystarlist）。无需参数。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listStarWeekly();
        const list = Array.isArray(r) ? r : (r.list || r.obj || []);
        if (!list.length)
            return toolResult("暂无收藏的周报。");
        const lines = [`⭐ 我收藏的周报（共 ${list.length} 篇）：`];
        for (const w of list) {
            lines.push(`  [${w.log_id || w.logId}] ${w.username || w.send_user_name || ""} · ${w.title || w.week_name || ""}`);
        }
        return toolResult(lines.join("\n"));
    },
};
/** ch8 - ⭐ 查询提醒配额（真调验证：{message:1000,phone:1000}，2026-07-13）*/
/** ⭐ 考勤状态（com694/attendance/info，2026-07-14）*/
export const yachGetAttendanceInfo = {
    name: "yach_get_attendance_info",
    label: "查考勤状态",
    description: "获取考勤状态（内网打卡开关 + 服务器时间）。command=start 表示内网考勤开启，stop=关闭。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const a = await ch7.getAttendanceInfo();
        const st = a.command === "start" ? "内网考勤开启 🟢" : "内网考勤关闭 ⚪";
        const t = a.server_time ? new Date(a.server_time * 1000).toLocaleString("zh-CN") : "";
        return toolResult(`${st}\n服务器时间: ${t}\n轮询间隔: ${a.timer_interval ?? "-"}s`);
    },
};
