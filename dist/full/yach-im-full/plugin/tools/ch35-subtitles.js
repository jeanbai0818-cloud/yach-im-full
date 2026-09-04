/**
 * 知音楼 Agent 工具集 — 直播字幕
 *
 * 调用 API: ../../api/ch35-aiimage/index.js
 *
 * 工具列表：
 *   yachAddLiveSubtitle — 添加直播字幕
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachAddLiveSubtitle = {
    name: "yach_add_live_subtitle",
    label: "添加直播字幕",
    description: "为直播添加字幕。liveId 传直播 id，content 为字幕内容。write 操作，执行前需用户确认。",
    parameters: Type.Object({
        liveId: Type.String({ description: "直播 id" }),
        content: Type.String({ description: "字幕内容" }),
        startTime: Type.Optional(Type.Integer({ description: "起始时间（秒，可选）" })),
        endTime: Type.Optional(Type.Integer({ description: "结束时间（秒，可选）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch35 = require("../../api/ch35-aiimage/index.js");
        const result = await ch35.aiimageComeducation({
            liveId: params.liveId,
            content: params.content,
            startTime: params.startTime,
            endTime: params.endTime,
        });
        return toolResult(`✅ 已添加直播字幕 liveId=${params.liveId}\n内容: ${params.content.slice(0, 100)}${params.content.length > 100 ? "..." : ""}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch35-subtitles.js.map