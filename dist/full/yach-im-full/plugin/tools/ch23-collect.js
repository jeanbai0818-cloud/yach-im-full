/**
 * 知音楼 Agent 工具集 — 收集表管理
 *
 * 调用 API: ../../api/ch33-collect/index.js
 *
 * 工具列表：
 *   yachAddCollect   — 添加收集（写）
 *   yachDelCollect   — 删除收集（写）
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachAddCollect = {
    name: "yach_add_collect",
    label: "添加收集表（写）",
    description: "添加一条收集表记录。写操作，执行前需用户确认。",
    parameters: Type.Object({
        title: Type.String({ description: "收集表标题" }),
        content: Type.Optional(Type.String({ description: "收集内容（可选）" })),
        collectId: Type.Optional(Type.String({ description: "所属收集表 id（可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch33 = require("../../api/ch33-collect/index.js");
        const result = await ch33.addCollect({
            title: params.title,
            content: params.content,
            collectId: params.collectId,
        });
        return toolResult(`✅ 已添加收集\ntitle=${params.title}\n${JSON.stringify(result)}`);
    },
};
export const yachDelCollect = {
    name: "yach_del_collect",
    label: "删除收集表（写）",
    description: "删除一条收集表记录。写操作，执行前需用户确认。",
    parameters: Type.Object({
        collectId: Type.String({ description: "收集记录 id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch33 = require("../../api/ch33-collect/index.js");
        const result = await ch33.delCollect(params.collectId);
        return toolResult(`✅ 已删除收集记录 collectId=${params.collectId}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch23-collect.js.map