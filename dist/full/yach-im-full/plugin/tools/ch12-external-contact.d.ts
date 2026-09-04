/**
 * 外部联系人管理工具
 * 对应 API: src/api/ch12-external-contact/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachAddExternalContact: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TString;
        reason: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachHandleExternalApply: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        applyId: Type.TString;
        accept: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetExternalApplyStatus: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        applyId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListMyExternalApps: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListExternalContacts: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteExternalContact: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch12-external-contact.d.ts.map