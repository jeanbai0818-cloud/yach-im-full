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
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachAddCollect: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        title: Type.TString;
        content: Type.TOptional<Type.TString>;
        collectId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDelCollect: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        collectId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch23-collect.d.ts.map