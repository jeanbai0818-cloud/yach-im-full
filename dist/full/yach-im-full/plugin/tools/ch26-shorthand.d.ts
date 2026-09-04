/**
 * 速记/录音管理工具
 * 对应 API: src/api/ch21-shorthand/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetShorthandList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetShorthandDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        shorthandId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUploadShorthand: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        id: Type.TString;
        url: Type.TString;
        title: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUpdateShorthand: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        id: Type.TString;
        title: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteShorthand: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        shorthandId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetShareToMeShorthandList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch26-shorthand.d.ts.map