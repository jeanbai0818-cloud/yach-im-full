/**
 * 知音楼 Agent 工具集 — 收藏提醒
 *
 * 调用 API: ../../api/ch34-collection-remind/index.js
 *
 * 工具列表：
 *   yachSetCollectionRemind — 收藏提醒
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachSetCollectionRemind = {
    name: "yach_set_collection_remind",
    label: "设置收藏提醒",
    description: "为收藏内容设置提醒（开启/关闭/定时）。写操作，执行前需用户确认。",
    parameters: Type.Object({
        collectId: Type.String({ description: "收藏记录 id" }),
        enabled: Type.Boolean({ description: "true=开启提醒, false=关闭提醒" }),
        remindTime: Type.Optional(Type.String({ description: "提醒时间（可选，如 09:00）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch34 = require("../../api/ch34-collection-remind/index.js");
        const result = await ch34.setCollectionRemind({
            collectId: params.collectId,
            enabled: params.enabled,
            remindTime: params.remindTime,
        });
        return toolResult(`✅ 已${params.enabled ? "开启" : "关闭"}收藏提醒\ncollectId=${params.collectId}${params.remindTime ? `, 提醒时间: ${params.remindTime}` : ""}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch24-collection-remind.js.map
