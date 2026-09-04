/**
 * 其他工具：AI 图像、未来人、投票、短链、收集
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
// ── AI 图像 ──
export const yachAiImageComeducation = {
    name: "yach_ai_image_comeducation",
    label: "AI 图像生成",
    description: "AI 图像综合教育（AI 图像生成）。写操作，需确认。",
    parameters: Type.Object({
        prompt: Type.String({ description: "图像描述" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch35-aiimage/index.js");
        const result = await ch.aiimageComeducation({ prompt: params.prompt });
        return toolResult(`✅ 已提交 AI 图像生成\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch28-others.js.map