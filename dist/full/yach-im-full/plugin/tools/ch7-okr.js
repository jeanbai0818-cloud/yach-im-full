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
export const yachListOkrTemplates = {
    name: "yach_list_okr_templates",
    label: "列 OKR 周期模板",
    description: "列出当前账号可用的 OKR 周期模板（年度/季度）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const t = await ch7.listOkrTemplates();
        return toolResult(t.map((x) => `• ${x.title}（type=${x.type}${x.current ? ",当前" : ""}）`).join("\n") || "(无模板)");
    },
};
/** ch7 - 列我的 OKR（真调，okr-api）*/
export const yachListMyOkrs = {
    name: "yach_list_my_okrs",
    label: "列我的 OKR",
    description: "列出当前账号的 OKR 列表（含 Objective/KR 数与标题预览）。" +
        "view: all(全部,默认) / annual(今年度) / quarter(本季度) / last-year(去年度)。只读。",
    parameters: Type.Object({
        view: Type.Optional(Type.String({ description: "all / annual / quarter / last-year，默认 all" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const r = await ch7.listMyOkrs({ view: params.view });
        const lines = r.items.map((o) => `• id=${o.id} ${o.templateTitle} | O:${o.objectiveCount} KR:${o.krCount}\n  ${o.titlePreview}`);
        return toolResult(`视图:${r.view} 共 ${r.total} 条\n${lines.join("\n") || "(无)"}`);
    },
};
/** ch7 - 看某条 OKR 详情（真调，okr-api）*/
export const yachGetOkrDetail = {
    name: "yach_get_okr_detail",
    label: "看 OKR 详情",
    description: "查看某条 OKR 的完整内容（Objective + KR 明细）。id 从 yach_list_my_okrs 获取。只读。",
    parameters: Type.Object({
        id: Type.String({ description: "OKR id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch7 = require("../../api/ch7-workbench/index.js");
        const d = await ch7.getOkrDetail(params.id);
        const parts = [`${d.templateTitle} | by ${d.userName} | O:${d.objectiveCount} KR:${d.krCount}${d.published ? " | 已发布" : ""}`];
        d.objectives.forEach((o, i) => {
            parts.push(`\nO${i + 1}: ${o.title}`);
            o.krs.forEach((kr) => parts.push(`  KR: ${kr.title}${kr.progress ? " (" + kr.progress + ")" : ""}`));
        });
        return toolResult(parts.join("\n"));
    },
};
/** ch7 - 列周报（我发出的，真调）*/
//# sourceMappingURL=ch7-okr.js.map