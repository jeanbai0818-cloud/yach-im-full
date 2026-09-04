/**
 * 其他工具：AI 图像、未来人、投票、短链、收集
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachAiImageComeducation: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        prompt: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch28-others.d.ts.map