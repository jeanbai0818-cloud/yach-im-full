/**
 * 入群申请管理工具
 * 对应 API: src/api/ch11-group-apply/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetGroupApplyList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAcceptGroupApply: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        userId: Type.TString;
        reason: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRejectGroupApply: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        userId: Type.TString;
        reason: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachBatchGroupApply: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        userIds: Type.TArray<Type.TString>;
        action: Type.TUnion<[Type.TLiteral<"accept">, Type.TLiteral<"reject">, Type.TLiteral<"ignore">]>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachIgnoreGroupApply: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetGroupApplyCount: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetGroupApplyConfig: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch11-group-apply.d.ts.map