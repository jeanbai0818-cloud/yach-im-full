/**
 * 讨论组管理工具
 * 对应 API: src/api/ch24-discuss/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachCreateDiscussGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        title: Type.TString;
        memberIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetDiscussInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachJoinDiscussGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupId: Type.TString;
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDismissDiscussGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSetDiscussGroupTitle: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupId: Type.TString;
        title: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAddUserToDiscussion: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupId: Type.TString;
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetDiscussMsgList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupId: Type.TString;
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch17-discuss.d.ts.map