/**
 * 知音楼 Agent 工具集 — 收藏提醒
 *
 * 调用 API: ../../api/ch34-collection-remind/index.js
 *
 * 工具列表：
 *   yachSetCollectionRemind — 收藏提醒
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachSetCollectionRemind: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        collectId: Type.TString;
        enabled: Type.TBoolean;
        remindTime: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch24-collection-remind.d.ts.map