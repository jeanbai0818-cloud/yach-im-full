/**
 * 通知 + 回收站 + 文件过期工具
 * 对应 API: src/api/ch23-notification/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetNoticeList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteRecycleBinFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
        receiveId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachCheckFileExpire: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch20-notice.d.ts.map