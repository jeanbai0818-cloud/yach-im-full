/**
 * 知音楼 Agent 工具集
 *
 * 工具通过当前 NIM 长连接查询云端历史/搜索和内存会话，
 * 或者直接调用 ch1-messaging 发消息；入站消息不落本地消息库。
 *
 * 工具列表：
 *   yach_send_message    — 发 P2P 消息（文本/图片/文件/音视频/图文混排）
 *   yach_send_group_text — 发群普通文本（不带 @）
 *   yach_get_history     — 查某会话历史消息
 *   yach_list_sessions   — 列出所有会话
 *   yach_search_messages — 全文搜索消息
 *   yach_get_status      — yach-im-full NIM 连接状态
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { formatMessageBody } = require("../../utils/message-content.js");
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
// ── 工具工厂 ─────────────────────────────────────────────────
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
export const yachSendMessage = {
    name: "yach_send_message",
    label: "发送知音楼消息",
    description: "向知音楼用户发送 P2P 消息。支持文本、图片、文件、音频、视频，以及图文混排（单条气泡）。" +
        "默认 to 填用户 user.id；群普通文本请使用 yach_send_group_text，或在本工具显式传 scene=team。",
    parameters: Type.Object({
        to: Type.String({ description: "接收方 user.id；scene=team 时填群 tid" }),
        scene: Type.Optional(Type.Union([Type.Literal("p2p"), Type.Literal("team")], {
            description: "目标会话类型，默认 p2p；群消息必须显式传 team",
        })),
        text: Type.Optional(Type.String({ description: "文本消息内容" })),
        file: Type.Optional(Type.String({ description: "本地文件绝对路径（发文件消息）" })),
        image: Type.Optional(Type.String({ description: "本地图片绝对路径（发图片消息）" })),
        audio: Type.Optional(Type.String({ description: "本地音频绝对路径" })),
        video: Type.Optional(Type.String({ description: "本地视频绝对路径" })),
        imageText: Type.Optional(Type.String({ description: "图文混排时的文字说明（需同时传 image）" })),
    }),
    async execute(_id, params, _signal, _onUpdate, toolContext) {
        const messaging = require("../../api/ch1-messaging/index.js");
        const { to, scene = "p2p", text, file, image, audio, video, imageText } = params;
        let result;
        if (scene === "team" && text)
            result = await messaging.sendTeamText(to, text);
        else if (scene === "team" && image && imageText)
            result = await messaging.sendImageWithText(to, image, imageText, "team", toolContext);
        else if (scene === "team")
            throw new Error("群聊通过此工具目前支持 text，或 image+imageText；文件/音频/视频请使用对应的群聊专用能力");
        else if (text)
            result = await messaging.sendText(to, text);
        else if (file)
            result = await messaging.sendFile(to, file, toolContext);
        else if (image && imageText)
            result = await messaging.sendImageWithText(to, image, imageText, "p2p", toolContext);
        else if (image)
            result = await messaging.sendImage(to, image, toolContext);
        else if (audio)
            result = await messaging.sendAudio(to, audio, toolContext);
        else if (video)
            result = await messaging.sendVideo(to, video, toolContext);
        else
            throw new Error("至少需要指定一种消息类型：text / file / image / audio / video");
        return toolResult(`✅ 消息已发送\nidServer: ${result.idServer}\nidClient: ${result.idClient}\n` +
            `timeMs: ${result.time}\ntime: ${new Date(result.time).toLocaleString("zh-CN")}\n` +
            `scene: ${result.scene}\nfrom: ${result.from}\nto: ${result.to}`);
    },
};
/**
 * 查历史消息
 * 从 NIM 云端查询，需要 NIM 长连接在运行。
 */
export const yachGetHistory = {
    name: "yach_get_history",
    label: "查知音楼历史消息",
    description: "查询与某用户或群组的历史消息（从 NIM 云端，不读取本地消息库）。" +
        "需要 NIM 长连接正在运行；群里的自定义卡片、引用回复和富文本会统一解码为可读正文。",
    parameters: Type.Object({
        userId: Type.Optional(Type.String({ description: "用户 user.id，自动转为 p2p:{userId}" })),
        sessionId: Type.Optional(Type.String({ description: "会话 ID，格式 p2p:{userId} 或 team:{teamId}，优先于 userId" })),
        limit: Type.Optional(Type.Integer({ description: "返回条数，默认 20，最大 100", default: 20, minimum: 1, maximum: 100 })),
        beforeTime: Type.Optional(Type.Integer({ description: "只返回此时间戳（毫秒）之前的消息，用于翻页" })),
    }),
    async execute(_id, params) {
        const { userId, sessionId, limit = 20, beforeTime } = params;
        const sid = sessionId ?? (userId ? `p2p:${userId}` : null);
        if (!sid)
            throw new Error("需要 userId 或 sessionId");
        const messaging = require("../../api/ch1-messaging/index.js");
        const msgs = await messaging.getHistory({ sessionId: sid, limit, endTime: beforeTime });
        if (!msgs.length) {
            return toolResult(`会话 ${sid} 没有查到云端历史消息`);
        }
        const lines = msgs.map((m) => {
            const t = new Date(m.time).toLocaleString("zh-CN");
            const body = formatMessageBody(m, { maxLength: 2_000 });
            return [
                t,
                `timeMs=${m.time}`,
                `scene=${m.scene}`,
                `from=${m.from}`,
                `to=${m.to}`,
                `idServer=${m.idServer || m.id || ""}`,
                `idClient=${m.idClient || ""}`,
                body,
            ].join("  ");
        });
        return toolResult(`会话 ${sid} 最近 ${msgs.length} 条消息：\n\n${lines.join("\n")}`);
    },
};
/**
 * 列出当前连接内存中的会话
 */
export const yachListSessions = {
    name: "yach_list_sessions",
    label: "列出知音楼会话",
    description: "列出当前 NIM 连接内存中的知音楼会话摘要；不读取持久化消息库。",
    parameters: Type.Object({
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 50", default: 50, minimum: 1, maximum: 200 })),
    }),
    async execute(_id, params) {
        const messaging = require("../../api/ch1-messaging/index.js");
        const sessions = (await messaging.getSessions()).slice(0, params.limit ?? 50);
        if (!sessions.length) {
            return toolResult("当前连接暂无内存会话记录");
        }
        const lines = sessions.map((s) => `${String(s.id || "").padEnd(25)}  未读:${String(s.unread || s.unreadCount || 0).padStart(3)}  ${formatMessageBody(s.lastMsg || s.lastMsgRaw || s)}`);
        return toolResult(`共 ${sessions.length} 个会话：\n\n${lines.join("\n")}`);
    },
};
/**
 * 全文搜索消息
 */
export const yachSearchMessages = {
    name: "yach_search_messages",
    label: "搜索知音楼消息",
    description: "在 NIM 云端全文搜索消息，返回匹配的消息列表；需在 NIM 控制台开通全文检索能力。",
    parameters: Type.Object({
        query: Type.String({ description: "搜索关键词" }),
        limit: Type.Optional(Type.Integer({ description: "最多返回条数，默认 10；NIM 服务端上限为 10", default: 10, minimum: 1, maximum: 10 })),
    }),
    async execute(_id, params) {
        const messaging = require("../../api/ch1-messaging/index.js");
        const result = await messaging.searchMessages(params.query, params.limit ?? 10);
        const msgs = Array.isArray(result) ? result : (result?.msgs || result?.messages || []);
        if (!msgs.length) {
            return toolResult(`云端未找到包含"${params.query}"的消息`);
        }
        const lines = msgs.map((m) => {
            const t = new Date(m.time).toLocaleString("zh-CN");
            const sessionId = m.sessionId || m.session_id || `${m.scene || "?"}:${m.to || "?"}`;
            return `[${t}] ${sessionId}  ${formatMessageBody(m, { maxLength: 240 })}`;
        });
        return toolResult(`云端搜索"${params.query}"，共 ${msgs.length} 条：\n\n${lines.join("\n")}`);
    },
};
/**
 * 查询 yach-im-full 自己的 NIM 长连接状态。
 * 不读取旧插件的本地 daemon，也不依赖 3457 端口。
 */
// ── ch2-ch9 工具 ─────────────────────────────────────────────────
export const yachGetStatus = {
    name: "yach_get_status",
    label: "知音楼连接状态",
    description: "查询知音楼 NIM 连接状态和消息存储策略。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const bridge = require("../../../nim-bridge.cjs");
        const { loadSession } = require("../../../auth/session.cjs");
        const session = loadSession();
        const connected = Boolean(bridge.getActiveNim());
        return toolResult([
            `NIM 连接状态: ${connected ? "✅ 已连接" : "❌ 未连接"}`,
            `NIM 账号: ${session?.user?.id ? String(session.user.id) : "未登录"}`,
            "消息存储: nim-cloud",
            "入站消息: 不写本地消息库；历史/搜索按需查询 NIM 云端",
        ].join("\n"));
    },
};
/**
 * ch2 - 搜索群组
 */
export const yachSendCard = {
    name: "yach_send_card",
    label: "知音楼发卡片消息",
    description: "向知音楼用户或群发送富文本/卡片消息（Markdown 格式，单条气泡渲染）。" +
        "默认 scene=p2p；群卡片必须显式传 scene=team，to 填群 tid。",
    parameters: Type.Object({
        to: Type.String({ description: "接收方 user.id；scene=team 时填群 tid" }),
        scene: Type.Optional(Type.Union([Type.Literal("p2p"), Type.Literal("team")], {
            description: "目标会话类型，默认 p2p；群卡片必须传 team",
        })),
        title: Type.Optional(Type.String({ description: "卡片标题（Markdown 加粗大标题）" })),
        content: Type.Optional(Type.String({ description: "卡片正文（Markdown 格式）" })),
        url: Type.Optional(Type.String({ description: "可选链接（附在正文末尾）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const r = await ch1.sendCard(params.to, {
            title: params.title,
            content: params.content,
            url: params.url,
        }, params.scene ?? "p2p");
        return toolResult(`✅ 卡片已发送\nidServer: ${r.idServer}\nidClient: ${r.idClient}\ntimeMs: ${r.time}\nto: ${r.to}`);
    },
};
/**
 * ch1 - 发投票（群聊专用，知音楼硬限制：投票仅支持群聊）
 * 服务端自动下发投票消息，无需手动发 NIM。
 */
export const yachSendVote = {
    name: "yach_send_vote",
    label: "知音楼发起投票",
    description: "在知音楼群聊里发起投票。to 填群 tid。" +
        "投票为知音楼硬限制：仅支持群聊（p2p 无效）。" +
        "服务端自动向群下发投票消息，无需额外操作。",
    parameters: Type.Object({
        to: Type.String({ description: "群 tid（投票仅群聊）" }),
        title: Type.String({ description: "投票标题" }),
        options: Type.Array(Type.String(), { description: "选项文字数组，至少 2 个" }),
        multi: Type.Optional(Type.Boolean({ description: "是否多选，默认 false" })),
        days: Type.Optional(Type.Integer({ description: "截止天数，默认 1 天", default: 1, minimum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const r = await ch1.sendVote(params.to, {
            title: params.title,
            options: params.options,
            multi: params.multi ?? false,
            days: params.days ?? 1,
        }, "team");
        return toolResult(`✅ 投票已创建\nvid: ${r?.vid ?? "?"}\n标题：${params.title}\n` +
            `选项：${(r?.voteOption || params.options).map((o) => typeof o === "string" ? o : o.content).join(" / ")}\n` +
            `截止：${r?.endTime ? new Date(r.endTime * 1000).toLocaleString("zh-CN") : "—"}`);
    },
};
/**
 * ch1 - 发 @ 消息（群聊）
 * 支持 @指定成员 或 @全员（atAccids=["all"]）。
 */
export const yachSendAtMessage = {
    name: "yach_send_at_message",
    label: "知音楼发@消息",
    description: "在知音楼群里发带蓝色高亮 @ 的文本消息。to 填群 tid；atAccids 填成员 user.id，" +
        "顺序必须与正文中的 @ 标记一致；传 [\"all\"] 为 @全员。",
    parameters: Type.Object({
        to: Type.String({ description: "群 tid" }),
        text: Type.String({ description: "消息正文，必须包含与 atAccids 一一对应的 @显示名 标记" }),
        atAccids: Type.Array(Type.String(), {
            description: "成员 user.id 数组，顺序与正文 @ 标记一致；@全员传 [\"all\"]",
            minItems: 1,
            maxItems: 50,
        }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const r = await ch1.sendTeamTextWithAt(params.to, params.text, params.atAccids);
        const reminder = r.reminderRegistered
            ? "提醒列表: ✅ 已登记"
            : `提醒列表: ⚠️ 未登记（${r.reminderError || "未知原因"}）`;
        return toolResult(`✅ @消息已发送\n${reminder}\n` +
            `idServer: ${r.idServer}\nidClient: ${r.idClient}\ntimeMs: ${r.time}\nto: ${r.to}`);
    },
};
/**
 * ch1 - 撤回消息（NIM recallMsg）
 */
export const yachRecallMessage = {
    name: "yach_recall_message",
    label: "知音楼撤回消息",
    description: "撤回一条知音楼消息；当前实测没有 2 分钟时间限制。" +
        "可传 raw 完整 NIM 消息 JSON，或传 idServer + idClient + to + scene + time + from。" +
        "time 必须是 yach_send_message / yach_get_history 返回的精确 timeMs。",
    parameters: Type.Object({
        raw: Type.Optional(Type.String({ description: "完整 NIM 消息 JSON；传入时无需其他字段" })),
        idServer: Type.Optional(Type.String({ description: "消息服务端 id（idServer）" })),
        idClient: Type.Optional(Type.String({ description: "消息客户端 id（idClient）" })),
        to: Type.Optional(Type.String({ description: "接收方（user.id 或 team.id）" })),
        scene: Type.Optional(Type.Union([Type.Literal("p2p"), Type.Literal("team")])),
        time: Type.Optional(Type.Number({ description: "精确毫秒时间戳 timeMs" })),
        from: Type.Optional(Type.String({ description: "发送方 accid（自己的 accid）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        await ch1.recallMessage(params.raw ? { raw: params.raw } : params);
        return toolResult(`✅ 消息已撤回\nidServer: ${params.idServer || "来自 raw"}`);
    },
};
/**
 * ch1 - 向群发送普通文本（不带 @）
 */
export const yachSendGroupText = {
    name: "yach_send_group_text",
    label: "知音楼群发普通文本",
    description: "向知音楼群发送普通文本消息，不会 @任何成员，也不会登记首页 @我提醒。" +
        "to 填群 tid；这是对外发送消息的写操作，调用前需用户确认。",
    parameters: Type.Object({
        to: Type.String({ description: "群 tid" }),
        text: Type.String({ description: "要发送的群消息正文" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const r = await ch1.sendTeamText(params.to, params.text);
        return toolResult(`✅ 群消息已发送\nidServer: ${r.idServer}\nidClient: ${r.idClient}\n` +
            `timeMs: ${r.time}\ntime: ${new Date(r.time).toLocaleString("zh-CN")}\n` +
            `scene: ${r.scene}\nfrom: ${r.from}\nto: ${r.to}`);
    },
};
/**
 * ch1 - 向群里的 AI 机器人发消息（触发机器人对话）
 * 机器人账号从 yach_list_ai_robots 获取。仅群聊有效（NIM 硬限制）。
 */
export const yachSendRobotMessage = {
    name: "yach_send_robot_message",
    label: "知音楼发机器人消息",
    description: "在知音楼群里 @ AI 机器人触发对话。to 填群 tid；robotAccount 填机器人 accid（用 yach_list_ai_robots 查）。" +
        "仅群聊有效（NIM SDK 限制：p2p 场景 robotInfo 被忽略）。",
    parameters: Type.Object({
        to: Type.String({ description: "群 tid" }),
        text: Type.String({ description: "发给机器人的问题文本" }),
        robotAccount: Type.String({ description: "机器人 accid（从 yach_list_ai_robots 返回）" }),
        function: Type.Optional(Type.String({ description: "机器人 function 参数（可选）" })),
        topic: Type.Optional(Type.String({ description: "机器人 topic 参数（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const r = await ch1.sendRobotMessage(params.to, params.text, params.robotAccount, {
            function: params.function,
            topic: params.topic,
        });
        return toolResult(`✅ 机器人消息已发送\nidServer: ${r.idServer}\nidClient: ${r.idClient}\ntimeMs: ${r.time}\nto: ${r.to}`);
    },
};
/**
 * ch4 - 建日程（写操作，真调验证 2026-07-12）
 * 路由：913scd/schedule/events/create
 */
export const yachAudioToText = {
    name: "yach_audio_to_text",
    label: "知音楼语音转文字",
    description: "把知音楼语音消息转成文字（知音楼/云信自带 audioToText 能力，不需模型）。" +
        "传音频 url（消息里的 file.url），或传 sessionId+msgId 按需从云端历史定位。需要 NIM 长连接运行。",
    parameters: Type.Object({
        url: Type.Optional(Type.String({ description: "音频 NOS 地址（NIM 消息的 file.url）" })),
        sessionId: Type.Optional(Type.String({ description: "云端历史会话 ID：p2p:{userId} 或 team:{teamId}，与 msgId 配合使用" })),
        msgId: Type.Optional(Type.String({ description: "消息 id（idServer），与 sessionId 配合从云端历史取音频 URL" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const text = await ch1.audioToText(params);
        return toolResult(text || "(空识别结果)");
    },
};
/**
 * ch8 - 发送提醒（应用内/短信/电话）—— 知音楼"新建提醒"能力。
 * ⭐ remindType: "0"应用内(默认) / "1"短信 / "2"电话。
 * 电话提醒会真实拨打接收人手机，属高打扰写操作，需谨慎。
 */
/** ⭐ 置顶会话列表（2026-07-14）*/
export const yachGetTopSessions = {
    name: "yach_get_top_sessions",
    label: "置顶会话列表",
    description: "获取置顶会话列表（含群和 p2p），返回 id/name/session_type（1=P2P,2=群）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const list = await ch1.getTopSessions();
        if (!list.length)
            return toolResult("暂无置顶会话");
        const lines = list.map((s) => `📌 ${s.name}（${s.session_type === "2" ? "群" : "单聊"}）id:${s.id}`);
        return toolResult(`共 ${list.length} 个置顶会话：\n\n${lines.join("\n")}`);
    },
};
/** ⭐ 消息高亮（@我/稍后处理，2026-07-14）*/
export const yachGetMessageHighlights = {
    name: "yach_get_message_highlights",
    label: "查@我/待办高亮",
    description: "获取消息高亮状态（@我/稍后处理/关注/公告是否有未读）。at=1 表示有未读@我。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const h = await ch1.getMessageHighlights();
        const lines = [
            `@我: ${h.at === "1" ? "有未读 🔴" : "无"}`,
            `稍后处理: ${h.later === "1" ? "有 🔴" : "无"}`,
            `关注: ${h.follow === "1" ? "有 🔴" : "无"}`,
            `公告: ${h.announcement === "1" ? "有 🔴" : "无"}`,
            `通知: ${h.notice === "1" ? "有 🔴" : "无"}`,
        ];
        return toolResult(lines.join("\n"));
    },
};
/** ⭐ 群未读状态（2026-07-14）*/
export const yachGetGroupUnread = {
    name: "yach_get_group_unread",
    label: "查群未读状态",
    description: "查询指定群是否有未读消息。传 group_tids（群 tid 数组）。只读。",
    parameters: Type.Object({
        groupTids: Type.Array(Type.String(), { description: "群 tid 数组" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch1 = require("../../api/ch1-messaging/index.js");
        const data = await ch1.getGroupUnreadStatus(params.groupTids);
        const lines = Object.entries(data).map(([tid, unread]) => `${tid}: ${unread ? "有未读 🔴" : "已读 ✅"}`);
        return toolResult(lines.length ? lines.join("\n") : "无数据");
    },
};
//# sourceMappingURL=ch1-messaging.js.map
