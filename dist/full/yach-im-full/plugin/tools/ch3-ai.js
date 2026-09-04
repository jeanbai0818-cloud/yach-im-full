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
export const yachListAiRobots = {
    name: "yach_list_ai_robots",
    label: "列出知音楼 AI 机器人",
    description: "列出知音楼内置可用的 AI 助手/机器人（airobot），返回 robot_id 与名称。与 IM 消息、robot webhook 均无关。",
    parameters: Type.Object({
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 50", default: 50, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const { createdAndConcern, hot } = await ch3.listRobots({ limit: params.limit ?? 50 });
        const fmt = (list, tag) => list.map((r) => `${tag} ${r.name}${r.robot_desc && r.robot_desc !== r.name ? ` (${r.robot_desc})` : ""} robot_id:${r.robot_uid || r.id}`);
        const lines = [
            `⭐ 我创建/关注 (${createdAndConcern.length} 个)`,
            ...fmt(createdAndConcern.slice(0, 20), "🤖"),
            createdAndConcern.length > 20 ? `  ...还有 ${createdAndConcern.length - 20} 个` : "",
            "",
            `🔥 热门助手 (${hot.length} 个)`,
            ...fmt(hot, "🤖"),
        ].filter(l => l !== undefined);
        return toolResult(lines.join("\n"));
    },
};
/**
 * ch2 - 查群成员（需已加入该群）
 */
export const yachSearchAssistantHistory = {
    name: "yach_search_assistant_history",
    label: "搜知音楼 AI 助手历史",
    description: "在知音楼 AI 助手（aide）的历史中搜索。返回 { total, lists }。只读。",
    parameters: Type.Object({
        query: Type.String({ description: "搜索关键词" }),
        limit: Type.Optional(Type.Integer({ description: "返回上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const result = await ch3.searchAssistantHistory(params.query, { pagesize: params.limit ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
/** ch3 - 搜索 AI 助手列表（2026-07-21）*/
export const yachSearchAiRobots = {
    name: "yach_search_ai_robots_by_name",
    label: "搜索AI助手",
    description: "按关键词搜索知音楼 AI 助手/机器人列表（93client/smart/assistant/search）。" +
        "与 yach_list_ai_robots 不同：可按名字搜索全公司助手。只读。",
    parameters: Type.Object({
        keyword: Type.String({ description: "搜索关键词（助手名称）" }),
        limit: Type.Optional(Type.Number({ description: "返回上限，默认 20", maximum: 100, minimum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const result = await ch3.searchAssistants(params.keyword, { size: params.limit ?? 20 });
        const list = result.list || [];
        if (!list.length)
            return toolResult(`未找到关键词"${params.keyword}"相关的 AI 助手`);
        const lines = [`共 ${result.total} 个匹配，返回 ${list.length} 个：`];
        for (const a of list) {
            const desc = a.robot_desc ? ` — ${a.robot_desc.slice(0, 50)}` : '';
            lines.push(`• ${a.name}（id: ${a.id}）${desc}`);
        }
        return toolResult(lines.join("\n"));
    },
};
/** ch4 - 工作台应用列表（真调，95search/app/user/list） */
export const yachListPrompts = {
    name: "yach_list_prompts",
    label: "列出 AI 机器人提示词",
    description: "列出指定 AI 机器人的 prompt（提示词）模板列表。" +
        "接口：GET 619_api/airobot/prompt/list（走 stream 域名）。" +
        "robotId 必传，从 yach_list_ai_robots 的 robot_id 拿。只读。",
    parameters: Type.Object({
        robotId: Type.String({ description: "AI 机器人 id（必传，来自 yach_list_ai_robots）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const result = await ch3.listPrompts(params.robotId);
        const list = result.list || [];
        if (!list.length)
            return toolResult(`该机器人（id:${params.robotId}）暂无自定义提示词（max_count:${result.max_count ?? "?"}）`);
        const lines = [`共 ${list.length} 个提示词（上限 ${result.max_count ?? "?"}）：`];
        for (const p of list) {
            lines.push(`• ${p.title || p.name || p.prompt_title || "（无标题）"}${p.content ? ": " + String(p.content).slice(0, 60) : ""}`);
        }
        return toolResult(lines.join("\n"));
    },
};
/**
 * ch1 - 语音转文字（知音楼自带能力，云信 NIM audioToText）
 * 传音频 url（消息里的 file.url），或由 ch1 工具传 sessionId+msgId 按需从云端历史定位。
 * 不需模型/不下载，走 daemon 现有 NIM 长连接。
 */
/** ch3 - 系统内置 aide 助手列表（2026-07-21）*/
export const yachListAideBots = {
    name: "yach_list_aide_bots",
    label: "系统内置助手列表",
    description: "列出知音楼系统内置的 aide 助手（bsvr/aide/user/list）：文件小助手/日历助手/提醒助手/OKR助手等。" +
        "与 yach_list_ai_robots 不同：这里是系统级 bot，不是 AI 大模型助手。可用 id 给助手发消息。只读。",
    parameters: Type.Object({
        limit: Type.Optional(Type.Number({ description: "返回上限，默认 100（一次取全部）", maximum: 200, minimum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const result = await ch3.listAideBots({ size: params.limit ?? 100 });
        const list = result.list || [];
        if (!list.length)
            return toolResult("没有找到内置助手");
        const lines = [`共 ${list.length} 个系统内置助手：`];
        for (const a of list) {
            const sign = a.sign ? ` — ${String(a.sign).slice(0, 40)}` : "";
            lines.push(`• [${a.id}] ${a.name}${sign}`);
        }
        return toolResult(lines.join("\n"));
    },
};
/** ch3 - 获取 prompt 详情（619_api/airobot/prompt/detail）*/
export const yachGetPromptDetail = {
    name: "yach_get_prompt_detail",
    label: "获取 AI Prompt 详情",
    description: "获取指定 prompt 的完整内容（标题/正文/是否公开等）。" +
        "接口：GET 619_api/airobot/prompt/detail?id=xxx（走 stream 域名）。" +
        "promptId 从 yach_list_prompts 获取。只读。",
    parameters: Type.Object({
        promptId: Type.String({ description: "prompt id（来自 yach_list_prompts）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const r = await ch3.getPromptDetail(params.promptId);
        return toolResult(JSON.stringify(r, null, 2));
    },
};
/** ch3 - 新建 prompt（619_api/airobot/prompt/add）*/
export const yachAddPrompt = {
    name: "yach_add_prompt",
    label: "新建 AI Prompt",
    description: "为指定 AI 机器人新建 prompt（提示词模板）。" +
        "接口：POST 619_api/airobot/prompt/add（走 stream 域名）。" +
        "robotId 从 yach_list_ai_robots 获取。写操作。",
    parameters: Type.Object({
        robotId: Type.String({ description: "AI 机器人 id（来自 yach_list_ai_robots）" }),
        title: Type.String({ description: "prompt 标题" }),
        content: Type.String({ description: "prompt 正文" }),
        open: Type.Optional(Type.Integer({ description: "是否公开：0=私有（默认），1=公开", default: 0, minimum: 0, maximum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const r = await ch3.addPrompt({ robotId: params.robotId, title: params.title, content: params.content, open: params.open ?? 0 });
        return toolResult(`✅ prompt 创建成功：${JSON.stringify(r)}`);
    },
};
/** ch3 - 编辑 prompt（619_api/airobot/prompt/edit）*/
export const yachEditPrompt = {
    name: "yach_edit_prompt",
    label: "编辑 AI Prompt",
    description: "编辑已有 prompt 的标题/正文/公开状态。" +
        "接口：POST 619_api/airobot/prompt/edit（走 stream 域名）。" +
        "promptId 从 yach_list_prompts 获取。写操作。",
    parameters: Type.Object({
        promptId: Type.String({ description: "prompt id（来自 yach_list_prompts）" }),
        title: Type.Optional(Type.String({ description: "新标题" })),
        content: Type.Optional(Type.String({ description: "新正文" })),
        open: Type.Optional(Type.Integer({ description: "是否公开：0=私有，1=公开", minimum: 0, maximum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const r = await ch3.editPrompt({ id: params.promptId, title: params.title || '', content: params.content || '', open: params.open ?? 0 });
        return toolResult(`✅ prompt 编辑成功：${JSON.stringify(r)}`);
    },
};
/** ch3 - 删除 prompt（619_api/airobot/prompt/del）*/
export const yachDelPrompt = {
    name: "yach_del_prompt",
    label: "删除 AI Prompt",
    description: "删除指定 prompt。接口：POST 619_api/airobot/prompt/del（走 stream 域名）。" +
        "promptId 从 yach_list_prompts 获取。写操作，不可恢复。",
    parameters: Type.Object({
        promptId: Type.String({ description: "要删除的 prompt id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const r = await ch3.delPrompt(params.promptId);
        return toolResult(`✅ prompt 已删除：${JSON.stringify(r)}`);
    },
};
/** ch3 - 获取负反馈标签列表（619_api/tag/list）*/
export const yachGetDownvoteTags = {
    name: "yach_get_downvote_tags",
    label: "获取 AI 负反馈标签",
    description: "获取对 AI 回答进行负反馈时的可选标签（如'内容不准确'/'与问题无关'等）。" +
        "接口：GET 619_api/tag/list?source=0（走 stream 域名）。只读。",
    parameters: Type.Object({
        source: Type.Optional(Type.Integer({ description: "来源类型，默认 0", default: 0 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const list = await ch3.getDownvoteTagList(params.source ?? 0);
        const lines = list.map((t) => `[${t.id}] ${t.name}（${t.name_en || ""}）type=${t.type ?? "?"}`);
        return toolResult(lines.length ? lines.join("\n") : "无标签数据");
    },
};
/** ch3 - 检查 AI 机器人名称是否可用（93client/airobot/name/check）*/
export const yachCheckRobotName = {
    name: "yach_check_robot_name",
    label: "检查 AI 机器人名称",
    description: "检查自定义 AI 机器人名称是否可用（是否已被占用）。" +
        "接口：POST 93client/airobot/name/check。只读。",
    parameters: Type.Object({
        name: Type.String({ description: "要检查的机器人名称" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const r = await ch3.checkRobotName(params.name);
        return toolResult(r.available ? `✅ 名称"${params.name}"可用` : `❌ 名称已被使用：${r.msg}`);
    },
};
/** ch3 - 创建自定义 AI 机器人（93client/airobot/add）*/
export const yachCreateAgentRobot = {
    name: "yach_create_agent_robot",
    label: "创建自定义 AI 机器人",
    description: "创建一个自定义 AI 机器人（知音楼龙虾分身）。" +
        "接口：POST 93client/airobot/add。返回 {id, name, uuid}。写操作。",
    parameters: Type.Object({
        name: Type.String({ description: "机器人名称（全局唯一，先用 yach_check_robot_name 检查）" }),
        desc: Type.Optional(Type.String({ description: "机器人描述/简介" })),
        modelId: Type.Optional(Type.Integer({ description: "模型 id，默认 1", default: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        const r = await ch3.createAgentRobot({ name: params.name, desc: params.desc || "", model_id: params.modelId ?? 1 });
        return toolResult(`✅ 机器人创建成功：id=${r.id} name=${r.name} uuid=${r.uuid}`);
    },
};
/** ch3 - 删除自定义 AI 机器人（93client/airobot/del）*/
export const yachDeleteAgentRobot = {
    name: "yach_delete_agent_robot",
    label: "删除自定义 AI 机器人",
    description: "删除指定自定义 AI 机器人（知音楼龙虾分身）。" +
        "接口：POST 93client/airobot/del。robotId 从 yach_list_ai_robots 获取。" +
        "写操作，不可恢复，谨慎使用。",
    parameters: Type.Object({
        robotId: Type.String({ description: "要删除的机器人 id（来自 yach_list_ai_robots）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch3 = require("../../api/ch3-ai/index.js");
        await ch3.deleteAgentRobot(params.robotId);
        return toolResult(`✅ 机器人（id:${params.robotId}）已删除`);
    },
};
//# sourceMappingURL=ch3-ai.js.map