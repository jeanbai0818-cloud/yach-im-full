/**
 * 会话置顶工具
 * 对应 API: src/api/ch13-session-top/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachAddSessionTop: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sessionId: Type.TString;
        topUid: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRemoveSessionTop: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sessionId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSortSessionTop: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        orders: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetSessionTopList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachGetSessionTopConfig: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachSetSessionTopConfig: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        config: Type.TUnion<[Type.TString, Type.TObject<{}>]>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch13-session-top.d.ts.map