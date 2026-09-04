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
export const yachListSchedules = {
    name: "yach_list_schedules",
    label: "查知音楼日程",
    description: "查询未来N天的日程安排，返回可用于详情、更新和删除的 sid，以及标题、时间、地点",
    parameters: Type.Object({
        days: Type.Optional(Type.Integer({ description: "查询未来天数，默认 7，最小 1，最大 30", default: 7, minimum: 1, maximum: 30 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const result = await ch4.getUpcomingSchedules(params.days ?? 7);
        const list = Array.isArray(result) ? result : (result?.list ?? []);
        if (!list.length) {
            return toolResult("未来暂无日程安排");
        }
        const lines = list.map((s) => {
            const begin = s.begin_time ? new Date(s.begin_time * 1000).toLocaleString("zh-CN") : "";
            const finish = s.finish_time ? new Date(s.finish_time * 1000).toLocaleString("zh-CN") : "";
            const sid = String(s.sid ?? s.event_id ?? s.schedule_id ?? s.id ?? "").trim();
            return `📅 ${s.title ?? ""}\n   sid：${sid || "（服务端未返回）"}\n   开始：${begin}  结束：${finish}\n   地点：${s.location ?? "（未填）"}`;
        });
        return toolResult(`共 ${list.length} 条日程：\n\n${lines.join("\n\n")}`);
    },
};
/**
 * ch5 - 列出知识库
 */
export const yachCreateSchedule = {
    name: "yach_create_schedule",
    label: "知音楼建日程",
    description: "在知音楼创建日程。需提供标题、开始/结束时间（ISO 字符串或秒级时间戳）。" +
        "可选：参与人 user.id 数组（joiner）、地点、重复规则（repeat，默认 '0' 不重复）。" +
        "写操作，执行前需用户确认。",
    parameters: Type.Object({
        title: Type.String({ description: "日程标题" }),
        start_time: Type.Union([Type.String(), Type.Number()], { description: "开始时间（ISO 字符串或秒级时间戳）" }),
        end_time: Type.Union([Type.String(), Type.Number()], { description: "结束时间（ISO 字符串或秒级时间戳）" }),
        location: Type.Optional(Type.String({ description: "地点（可选）" })),
        joiner: Type.Optional(Type.Array(Type.String(), { description: "参与人 user.id 数组（可选）" })),
        repeat: Type.Optional(Type.String({ description: "重复规则，默认 '0'（不重复）" })),
        content: Type.Optional(Type.String({ description: "日程描述/备注（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const toSec = (t) => {
            if (typeof t === "number")
                return t > 1e10 ? Math.floor(t / 1000) : t;
            const d = new Date(t);
            return isNaN(d.getTime()) ? parseInt(t) : Math.floor(d.getTime() / 1000);
        };
        const body = {
            title: params.title,
            start_time: toSec(params.start_time),
            end_time: toSec(params.end_time),
        };
        if (params.location)
            body.location = params.location;
        if (params.joiner)
            body.joiner = params.joiner;
        if (params.repeat)
            body.repeat = params.repeat;
        if (params.content)
            body.content = params.content;
        const r = await ch4.createSchedule(body);
        const sid = r?.sid ?? r?.event_id ?? r?.schedule_id ?? r?.id ?? "";
        return toolResult(`✅ 日程已创建\nID: ${sid}\n标题：${params.title}\n` +
            `开始：${new Date(body.start_time * 1000).toLocaleString("zh-CN")}\n` +
            `结束：${new Date(body.end_time * 1000).toLocaleString("zh-CN")}` +
            (r?.sid_changed ? `\n初始 sid：${r.initial_sid}\n参与人更新后新 sid：${sid}` : ""));
    },
};
/**
 * ch4 - 删除日程（写操作，真调验证 2026-07-12）
 * 路由：913scd/schedule/events/delete
 * ⚠️ 需用 sid（列表里的字段），不是带后缀的 id；缺 scope 报 30014。
 */
export const yachDeleteSchedule = {
    name: "yach_delete_schedule",
    label: "知音楼删日程",
    description: "删除知音楼日程。需提供日程 sid（用 yach_list_schedules 查到的 sid 字段，不是带后缀的 id）。" +
        "scope=3 删除全部（含重复），scope=1 仅删本次，scope=0 删本次及之后。默认 scope=3。" +
        "写操作，执行前需用户确认。",
    parameters: Type.Object({
        sid: Type.String({ description: "日程 sid（从 yach_list_schedules 返回的 sid 字段）" }),
        scope: Type.Optional(Type.Integer({ description: "删除范围：3=全部（默认），1=仅本次，0=本次及之后", default: 3 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        await ch4.deleteSchedule(params.sid, { scope: params.scope ?? 3 });
        const scopeLabel = { 3: "全部", 1: "仅本次", 0: "本次及之后" };
        return toolResult(`✅ 日程已删除\nID: ${params.sid}\n删除范围：${scopeLabel[params.scope ?? 3] ?? "全部"}`);
    },
};
export const yachRespondToSchedule = {
    name: "yach_respond_to_schedule",
    label: "回应知音楼日程邀请",
    description: "接受或拒绝一个知音楼日程邀请（events/feedback）。会改变参与状态并通知日程侧，执行前需用户确认。",
    parameters: Type.Object({
        sid: Type.String({ description: "日程 sid" }),
        action: Type.Union([Type.Literal("accept"), Type.Literal("reject")], { description: "接受或拒绝" }),
        reason: Type.Optional(Type.String({ description: "拒绝原因；接受时忽略" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        await ch4.respondToSchedule(params.sid, params.action === "accept" ? 1 : 2, params.reason);
        return toolResult(params.action === "accept" ? "✅ 已接受该日程" : "✅ 已拒绝该日程");
    },
};
/**
 * ch4 - 查单个日程详情（只读，真调验证 2026-07-13）
 * 路由：913scd/schedule/events/info
 */
export const yachGetScheduleDetail = {
    name: "yach_get_schedule_detail",
    label: "知音楼日程详情",
    description: "查看单个日程的完整详情（标题/时间/地点/参与人/创建人/重复规则等）。需日程 id（从 yach_list_schedules 的 sid 字段拿）。只读。",
    parameters: Type.Object({
        event_id: Type.String({ description: "日程 id / sid" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const d = await ch4.getScheduleDetail(params.event_id);
        const fmt = (ts) => ts ? new Date(Number(ts) * 1000).toLocaleString("zh-CN", { hour12: false }) : "-";
        const lines = [
            `🗓 ${d.title || "(无标题)"}`,
            `时间：${fmt(d.begin_time)} ~ ${fmt(d.finish_time)}`,
        ];
        if (d.location)
            lines.push(`地点：${d.location}`);
        if (d.summary)
            lines.push(`备注：${d.summary}`);
        if (d.repeat_txt)
            lines.push(`重复：${d.repeat_txt}`);
        const participants = d.participant ?? d.joiner ?? d.joiner_list ?? d.members ?? [];
        const participantList = Array.isArray(participants) ? participants : String(participants || "").split(",").filter(Boolean);
        const participantIds = participantList.map((p) => typeof p === "object" && p ? (p.uid ?? p.id ?? p.user_id ?? p.name ?? "") : p).filter(Boolean);
        lines.push(`参与人：${participantIds.length ? participantIds.join(", ") : "（无）"}`);
        lines.push(`创建人 uid：${d.creator ?? "-"}，sid：${d.sid ?? d.event_id ?? d.schedule_id ?? d.id ?? params.event_id}`);
        return toolResult(lines.join("\n"));
    },
};
/**
 * ch4 - 更新（编辑）日程（写操作，需确认）
 * 路由：先 events/info 读全字段 → 覆盖 → events/create + id（同桌面端保存编辑）
 */
export const yachUpdateSchedule = {
    name: "yach_update_schedule",
    label: "知音楼改日程",
    description: "修改已有日程（改时间/改标题/改参与人/改地点等）。先读原日程保留未改字段，只覆盖传入的。" +
        "需 event_id（sid）+ 要改的字段（start_time/end_time 用秒时间戳或 ISO；joiner 传 uid 数组会整体替换参与人）。写操作，执行前需用户确认。",
    parameters: Type.Object({
        event_id: Type.String({ description: "待修改日程 id / sid" }),
        title: Type.Optional(Type.String({ description: "新标题" })),
        start_time: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "新开始（ISO 或秒时间戳）" })),
        end_time: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "新结束（ISO 或秒时间戳）" })),
        joiner: Type.Optional(Type.Array(Type.String(), { description: "新参与人 uid 数组（整体替换）" })),
        address: Type.Optional(Type.String({ description: "新地点" })),
        remark: Type.Optional(Type.String({ description: "新备注" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const toSec = (t) => {
            if (t == null)
                return undefined;
            if (typeof t === "number")
                return t > 1e10 ? Math.floor(t / 1000) : t;
            const d = new Date(t);
            return isNaN(d.getTime()) ? Number(t) : Math.floor(d.getTime() / 1000);
        };
        const result = await ch4.updateSchedule(params.event_id, {
            title: params.title,
            start_time: toSec(params.start_time),
            end_time: toSec(params.end_time),
            joiner: params.joiner,
            address: params.address,
            remark: params.remark,
        });
        return toolResult(`✅ 日程已更新\n旧 sid：${params.event_id}\n当前 sid：${result.sid}` +
            (result.sid_changed ? "\n注意：服务端已更换 sid，后续详情、修改和删除必须使用当前 sid。" : ""));
    },
};
/**
 * ch4 - 日程冲突检测（只读，真调验证 2026-07-13）
 * 路由：913scd/schedule/events/conflict
 */
export const yachCheckScheduleConflict = {
    name: "yach_check_schedule_conflict",
    label: "知音楼日程冲突检测",
    description: "检查一组参与人在指定时间窗口内的日程冲突。需 uids（user.id 数组，先用 yach_search_users 查）+ 开始/结束时间。" +
        "返回哪些人有冲突（conflicts）、请假人（leaves）及具体时段。只读。",
    parameters: Type.Object({
        uids: Type.Array(Type.String(), { description: "参与人 user.id 数组" }),
        start_time: Type.Union([Type.String(), Type.Number()], { description: "窗口开始（ISO 字符串或秒级时间戳）" }),
        end_time: Type.Union([Type.String(), Type.Number()], { description: "窗口结束（ISO 字符串或秒级时间戳）" }),
        event_id: Type.Optional(Type.String({ description: "排除的日程 id（改期时可传，不把它自己算冲突）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const toMs = (t) => {
            if (typeof t === "number")
                return t > 1e10 ? t : t * 1000;
            const d = new Date(t);
            return isNaN(d.getTime()) ? Number(t) * 1000 : d.getTime();
        };
        const r = await ch4.checkScheduleConflict({
            uids: params.uids,
            startTime: toMs(params.start_time),
            endTime: toMs(params.end_time),
            eventId: params.event_id,
        });
        const conflicts = r?.conflicts || [];
        const leaves = r?.leaves || [];
        const lines = [
            `🔍 冲突检测完成（共 ${params.uids.length} 人）`,
            `有冲突：${conflicts.length ? conflicts.join(", ") : "无"}`,
            `请假中：${leaves.length ? leaves.join(", ") : "无"}`,
        ];
        if (!conflicts.length && !leaves.length)
            lines.push("✅ 该时间窗口所有人都空闲。");
        return toolResult(lines.join("\n"));
    },
};
/**
 * ch4 - 推荐共同空闲时段（只读，真调验证 2026-07-13）
 * 路由：913scd/schedule/events/recommend/freetime
 */
export const yachRecommendFreetime = {
    name: "yach_recommend_freetime",
    label: "知音楼空闲时段推荐",
    description: "在指定时间窗口内，为一组参与人推荐共同空闲的开会时段（服务端自动避开各人已有日程）。" +
        "需 uids（user.id 数组，先用 yach_search_users 查）+ 开始/结束时间。无合适时时会提示“没有合适的时间”。只读。",
    parameters: Type.Object({
        uids: Type.Array(Type.String(), { description: "参与人 user.id 数组" }),
        start_time: Type.Union([Type.String(), Type.Number()], { description: "窗口开始（ISO 字符串或秒级时间戳）" }),
        end_time: Type.Union([Type.String(), Type.Number()], { description: "窗口结束（ISO 字符串或秒级时间戳）" }),
        event_id: Type.Optional(Type.String({ description: "排除的日程 id（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const toMs = (t) => {
            if (typeof t === "number")
                return t > 1e10 ? t : t * 1000;
            const d = new Date(t);
            return isNaN(d.getTime()) ? Number(t) * 1000 : d.getTime();
        };
        const r = await ch4.recommendFreetime({
            uids: params.uids,
            startTime: toMs(params.start_time),
            endTime: toMs(params.end_time),
            eventId: params.event_id,
        });
        const obj = r?.obj || {};
        const slots = Array.isArray(obj) ? obj : (obj.list || obj.slots || obj.freetime || []);
        if (r?.msg && (!slots || !slots.length)) {
            return toolResult(`⏰ 推荐结果：${r.msg}`);
        }
        const fmt = (t) => new Date((Number(t) > 1e10 ? Number(t) : Number(t) * 1000)).toLocaleString("zh-CN");
        const lines = [`📅 共同空闲时段推荐（${params.uids.length} 人）：`];
        if (Array.isArray(slots) && slots.length) {
            for (const s of slots.slice(0, 20)) {
                const st = s.start_time ?? s.start ?? s.begin_time ?? (Array.isArray(s) ? s[0] : null);
                const et = s.end_time ?? s.end ?? s.finish_time ?? (Array.isArray(s) ? s[1] : null);
                lines.push(st && et ? `  ${fmt(st)} ~ ${fmt(et)}` : `  ${JSON.stringify(s)}`);
            }
        }
        else {
            lines.push("  " + JSON.stringify(obj).slice(0, 400));
        }
        return toolResult(lines.join("\n"));
    },
};
/**
 * ch8 - 获取提醒列表
 */
export const yachListWorkbenchApps = {
    name: "yach_list_workbench_apps",
    label: "列出知音楼工作台应用",
    description: "列出当前账号工作台的所有微应用（会议室预约/加班餐/报销等），返回 app_name/app_id/启动 url/open_way。支持关键词过滤。只读。",
    parameters: Type.Object({
        query: Type.Optional(Type.String({ description: "按应用名关键词过滤（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        let apps = await ch4.listWorkbenchApps();
        if (params.query) {
            const q = String(params.query);
            apps = apps.filter((a) => (a.app_name || "").includes(q) || (a.app_name_en || "").toLowerCase().includes(q.toLowerCase()));
        }
        const slim = apps.map((a) => ({ app_name: a.app_name, app_id: a.app_id, url: a.app_redirect_pc || a.app_redirect, open_way: a.app_open_way }));
        return toolResult(`共 ${slim.length} 个应用\n${JSON.stringify(slim, null, 2)}`);
    },
};
/** ch4 - 会议室预约（订会议室）入口（真调） */
export const yachGetMeetingRoomEntry = {
    name: "yach_get_meeting_room_entry",
    label: "获取会议室预约入口",
    description: "获取“会议室预约”微应用的启动地址与元数据。⭐ 主 capi 无原生预订接口，预订在 SSO 单点登录的微应用页（WebView）内完成；本工具返回真实可打开的 url。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const r = await ch4.getMeetingRoomEntry();
        return toolResult(JSON.stringify(r, null, 2));
    },
};
/** ch4 - 搜索空闲会议室（真调，huiyi.tal.com SSO）*/
export const yachSearchMeetingRooms = {
    name: "yach_search_meeting_rooms",
    label: "搜索空闲会议室",
    description: "搜索指定日期/时段内空闲的会议室（会议室预约系统，走好未来统一登录 SSO，纯真调）。" +
        "必填 date(YYYY-MM-DD)、start/end(HH:MM)、office(办公区名，如“好未来大楼”)；city 多城市重名时补。" +
        "可传 workstation（如 TAL-4D-104G），工具会解析为4层D区并把同层同区房间排在前面；支持 limit 查看更多结果。只读。",
    parameters: Type.Object({
        date: Type.String({ description: "日期 YYYY-MM-DD" }),
        start: Type.String({ description: "开始时间 HH:MM" }),
        end: Type.String({ description: "结束时间 HH:MM" }),
        office: Type.String({ description: "办公区名，如 好未来大楼" }),
        city: Type.Optional(Type.String({ description: "城市名（重名时补），如 北京市" })),
        keyword: Type.Optional(Type.String({ description: "房间名关键词过滤（可选）" })),
        workstation: Type.Optional(Type.String({ description: "工位号，如 TAL-4D-104G；自动解析楼层和区域并优先排序" })),
        floor: Type.Optional(Type.String({ description: "优先楼层，如 4（可选，覆盖工位解析）" })),
        area: Type.Optional(Type.String({ description: "优先区域，如 D（可选，覆盖工位解析）" })),
        limit: Type.Optional(Type.Integer({ description: "展示条数，默认30，最大200", default: 30, minimum: 1, maximum: 200 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const r = await ch4.searchMeetingRooms(params);
        const limit = params.limit ?? 30;
        const slim = r.rooms.slice(0, limit).map((rm) => ({
            name: rm.name, id: rm.id, capacity: rm.capacity, floor: rm.floorName,
            city: rm.scope.cityName, office: rm.scope.officeName,
        }));
        const hint = r.locationHint?.floor
            ? `；位置偏好 ${r.locationHint.floor}层${r.locationHint.area ? r.locationHint.area + "区" : ""}（同层${r.sameFloorCount}间，同区${r.sameAreaCount}间）`
            : "";
        return toolResult(`${r.date} ${r.start}-${r.end} @ ${r.requestedOffice}${r.requestedCity ? "/" + r.requestedCity : ""} 空闲 ${r.returned} 间${hint}（展示前 ${Math.min(limit, r.returned)}）\n${JSON.stringify(slim, null, 2)}`);
    },
};
/** ch4 - 查会议室占用（真调）*/
export const yachMeetingRoomBookings = {
    name: "yach_meeting_room_bookings",
    label: "查会议室占用",
    description: "查某个会议室某天的预订/占用情况（会议室预约系统，真调）。roomQuery 传房间名或 id，date 传 YYYY-MM-DD。只读。",
    parameters: Type.Object({
        roomQuery: Type.String({ description: "会议室名或 id" }),
        date: Type.String({ description: "日期 YYYY-MM-DD" }),
        office: Type.Optional(Type.String({ description: "办公区名（可选，缩小匹配范围）" })),
        city: Type.Optional(Type.String({ description: "城市名（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const r = await ch4.readMeetingRoomBookings(params);
        const bookings = r.bookings.map((b) => `${b.start}-${b.end} ${b.title || "(无标题)"}${b.mine ? " [我的]" : ""}`);
        return toolResult(`${r.room.name}（${r.room.scope.cityName}/${r.room.scope.officeName}/${r.room.floorName}, id=${r.room.id}）\n${r.date} 共 ${r.returned} 场：\n${bookings.join("\n") || "(空闲一整天)"}`);
    },
};
/** ch4 - 预订会议室（写操作，真调）*/
export const yachBookMeetingRoom = {
    name: "yach_book_meeting_room",
    label: "预订会议室",
    description: "预订会议室（写操作，真下单到会议室预约系统）。⚠️ 会真实占用房间，务必先确认日期/时段/房间/办公区。" +
        "必填 date(YYYY-MM-DD)、start/end(HH:MM)、roomQuery(房间名或id)、title(会议标题)、office(办公区)。",
    parameters: Type.Object({
        date: Type.String({ description: "日期 YYYY-MM-DD" }),
        start: Type.String({ description: "开始时间 HH:MM" }),
        end: Type.String({ description: "结束时间 HH:MM" }),
        roomQuery: Type.String({ description: "会议室名或 id" }),
        title: Type.String({ description: "会议标题" }),
        office: Type.String({ description: "办公区名，如 好未来大楼" }),
        city: Type.Optional(Type.String({ description: "城市名（可选）" })),
        remark: Type.Optional(Type.String({ description: "备注（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const r = await ch4.bookMeetingRoom(params);
        return toolResult(`✅ ${r.message}\nmeetingId=${r.meetingId}（回读校验:${r.verified ? "通过" : "未确认"}）\n${r.room.name} | ${r.date} ${r.start}-${r.end} | ${r.title}`);
    },
};
/** ch4 - 取消会议室预订（写操作，真调）*/
export const yachCancelMeetingRoom = {
    name: "yach_cancel_meeting_room",
    label: "取消会议室预订",
    description: "取消已预订的会议室（写操作，真调）。传 meetingId（可从 yach_meeting_room_bookings 查到）。⚠️ 用精确 meetingId，不要凭标题模糊取消。",
    parameters: Type.Object({
        meetingId: Type.String({ description: "会议 id（meetingId）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch4 = require("../../api/ch4-collab/index.js");
        const r = await ch4.cancelMeetingRoom(params);
        return toolResult(`✅ ${r.message}\nmeetingId=${r.meetingId}${r.title ? "\n" + r.title + " | " + r.date + " " + r.start + "-" + r.end : ""}`);
    },
};
/** ch7 - 列 OKR 周期模板（真调，okr-api）*/
//# sourceMappingURL=ch4-collab.js.map