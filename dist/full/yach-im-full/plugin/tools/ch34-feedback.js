/**
 * 知音楼 Agent 工具集 — 反馈
 *
 * 调用 API: ../../api/ch34-collection-remind/index.js
 *
 * 工具列表：
 *   yachFeedbackSdkCreate — 创建反馈 SDK
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachFeedbackSdkCreate = {
    name: "yach_feedback_sdk_create",
    label: "创建反馈",
    description: "提交一条反馈到 SDK 系统。包含反馈类型、内容和截图等。write 操作，执行前需用户确认。",
    parameters: Type.Object({
        category: Type.Optional(Type.String({ description: "反馈分类（可选，如 bug/建议/体验）" })),
        content: Type.String({ description: "反馈内容" }),
        screenshot: Type.Optional(Type.String({ description: "截图本地路径（可选）" })),
        contact: Type.Optional(Type.String({ description: "联系方式（可选）" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch35-feedback/index.js");
        const result = await ch.createFeedback({
            category: params.category,
            content: params.content,
            screenshot: params.screenshot,
            contact: params.contact,
        });
        return toolResult(`✅ 已提交反馈\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch34-feedback.js.map