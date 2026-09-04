/**
 * 知音楼 Agent 工具集 — 短链转换
 *
 * 调用 API: ../../api/ch32-shortlink/index.js
 *
 * 工具列表：
 *   yachShortLinkTransLong — 短链转长链
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachShortLinkTransLong: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        shortUrl: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch22-shortlink.d.ts.map