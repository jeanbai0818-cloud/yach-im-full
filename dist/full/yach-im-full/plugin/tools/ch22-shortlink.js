/**
 * 知音楼 Agent 工具集 — 短链转换
 *
 * 调用 API: ../../api/ch32-shortlink/index.js
 *
 * 工具列表：
 *   yachShortLinkTransLong — 短链转长链
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachShortLinkTransLong = {
    name: "yach_short_link_trans_long",
    label: "短链转长链",
    description: "将知音楼短链接转换为原始长链接。shortUrl 传短链地址。只读。",
    parameters: Type.Object({
        shortUrl: Type.String({ description: "短链 URL 地址" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch32 = require("../../api/ch32-shortlink/index.js");
        const result = await ch32.shortLinkTransLong(params.shortUrl);
        const longUrl = result?.long || result?.longUrl || result?.url || JSON.stringify(result);
        return toolResult(`短链: ${params.shortUrl}\n长链: ${longUrl}`);
    },
};
//# sourceMappingURL=ch22-shortlink.js.map