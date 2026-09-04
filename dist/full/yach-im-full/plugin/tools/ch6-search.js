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
/**
 * ch6 - 全局搜索
 */
export const yachGlobalSearch = {
    name: "yach_global_search",
    label: "知音楼全局搜索",
    description: "在知音楼全局搜索（消息/文档/人员），返回搜索结果",
    parameters: Type.Object({
        query: Type.String({ description: "搜索关键词" }),
        limit: Type.Optional(Type.Integer({ description: "返回数量上限，默认 20", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch6 = require("../../api/ch6-search/index.js");
        const result = await ch6.searchAll(params.query, { pagesize: params.limit ?? 20 });
        const lines = [];
        const persons = result.person || [];
        const groups = result.group || [];
        const apps = result.application || [];
        if (persons.length) {
            lines.push(`👤 人员（${persons.length}）：`);
            for (const p of persons.slice(0, 5)) {
                lines.push(`  • ${p.name}（id:${p.id}，工号:${p.workCode || "?"}，部门:${p.deptName || "?"}）`);
            }
        }
        if (groups.length) {
            lines.push(`👥 群组（${groups.length}）：`);
            for (const g of groups.slice(0, 5)) {
                lines.push(`  • ${g.name}（tid:${g.tid}）`);
            }
        }
        if (apps.length) {
            lines.push(`📱 应用（${apps.length}）：`);
            for (const a of apps.slice(0, 3)) {
                lines.push(`  • ${a.name || a.app_name}`);
            }
        }
        if (!lines.length)
            return toolResult(`未找到"${params.query}"相关内容`);
        return toolResult(lines.join("\n"));
    },
};
/** ch6 - URL 安全检查（com694/internal/urlcheck，只读）*/
export const yachCheckUrlSafety = {
    name: "yach_check_url_safety",
    label: "URL 安全检查",
    description: "检查一个 URL 是否安全（com694/internal/urlcheck）。" +
        "返回 result=0 表示安全（action=open），result=1 表示疑似钓鱼/不安全（action=copy）。" +
        "可用于判断知音楼消息中的链接是否可信。只读。",
    parameters: Type.Object({
        url: Type.String({ description: "要检查的 URL（含协议，如 https://...）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const { post } = require("../../utils/request.js");
        const r = await post("com694/internal/urlcheck", { url: params.url });
        const obj = r.obj ?? {};
        const safe = obj.result === 0;
        const action = obj.action ?? "unknown";
        return toolResult(`URL: ${obj.url ?? params.url}\n` +
            `安全性: ${safe ? "✅ 安全" : "⚠️ 疑似不安全/钓鱼"}（result=${obj.result}）\n` +
            `建议操作: ${action}`);
    },
};
/** ch6 - 直播列表 */
export const yachListLives = {
    name: "yach_list_lives",
    label: "直播列表",
    description: "列出知音楼直播课程列表。" +
        "history=false 返回当前或将来的直播；history=true 返回历史直播（已结束，包含回放 URL）。" +
        "字段：title / speakerName / startedAt / endedAt / status（0=未开始 1=直播中 2=已结束）/ replayUrl。" +
        "只读。",
    parameters: Type.Object({
        history: Type.Optional(Type.Boolean({ description: "是否查历史直播，默认 false（当前/将来）", default: false })),
        page: Type.Optional(Type.Integer({ description: "页码，默认 1", default: 1, minimum: 1 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch6 = require("../../api/ch6-search/index.js");
        const result = await ch6.listLives({ page: params.page ?? 1, history: params.history ?? false });
        const items = result.items ?? [];
        if (items.length === 0) {
            return toolResult(`无${params.history ? "历史" : "当前"}直播记录。页码: ${result.currentPage}/${result.lastPage}`);
        }
        const STATUS = ['\u672a\u5f00\u59cb', '\u76f4\u64ad\u4e2d', '\u5df2\u7ed3\u675f', '\u5df2\u7ed3\u675f'];
        const lines = items.map((item) => [
            `**${item.title}**`,
            `  ID: ${item.id} | 状态: ${STATUS[item.status] ?? item.status}`,
            `  主讲: ${item.speakerName ?? item.creatorName ?? '-'}`,
            item.startedAt ? `  时间: ${item.startedAt} ~ ${item.endedAt ?? '-'}` : '',
            item.replayUrl && item.replayEnabled ? `  回放: ${item.replayUrl}` : '',
            item.playTime ? `  时长: ${Math.round(item.playTime / 60)}分钟` : '',
        ].filter(Boolean).join('\n'));
        return toolResult(`直播列表（${params.history ? "历史" : "当前"}，第 ${result.currentPage}/${result.lastPage} 页，共 ${items.length} 条）:\n\n` +
            lines.join('\n\n'));
    },
};
/**
 * ch1 - 发卡片/富文本消息（Markdown，已实测可渲染，type=15）
 * 适合发带格式的通知卡片。
 */
/** ⭐ 链接预览（2026-07-21）*/
export const yachFetchLinkPreview = {
    name: "yach_fetch_link_preview",
    label: "链接预览",
    description: "抓取 URL 页面元信息（标题/描述/icon/图片）。" +
        "接口：94capi/util/link/grab。对外部 URL（GitHub 等）可能返回空，内网/国内 URL 更稳定。只读。",
    parameters: Type.Object({
        url: Type.String({ description: "要预览的 URL（含 https://）" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const { post } = require("../../utils/request.js");
        const r = await post("94capi/util/link/grab", { url: params.url });
        if (r.code !== 200)
            throw new Error(`link/grab failed: ${r.code} ${r.msg}`);
        const o = r.obj || {};
        if (!o.title && !o.description)
            return toolResult(`⚠️ 无法获取链接预览（可能外网屏蔽或 URL 无效）`);
        const lines = [];
        if (o.title)
            lines.push(`📄 标题: ${o.title}`);
        if (o.description)
            lines.push(`📝 描述: ${o.description.slice(0, 200)}`);
        if (o.icon)
            lines.push(`🔗 icon: ${o.icon}`);
        if (o.image)
            lines.push(`🖼 image: ${o.image}`);
        return toolResult(lines.join("\n"));
    },
};
//# sourceMappingURL=ch6-search.js.map