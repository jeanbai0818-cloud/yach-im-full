/**
 * 知音楼 Agent 工具集 — 反馈
 *
 * 调用 API: ../../api/ch34-collection-remind/index.js
 *
 * 工具列表：
 *   yachFeedbackSdkCreate — 创建反馈 SDK
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachFeedbackSdkCreate: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        category: Type.TOptional<Type.TString>;
        content: Type.TString;
        screenshot: Type.TOptional<Type.TString>;
        contact: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch34-feedback.d.ts.map