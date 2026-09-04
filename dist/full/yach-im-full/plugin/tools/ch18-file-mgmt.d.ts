/**
 * 文件管理工具
 * 对应 API: src/api/ch20-file/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetFileInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachCreateFolder: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        parentId: Type.TString;
        name: Type.TString;
        spaceId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUploadFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        name: Type.TString;
        fileUrl: Type.TString;
        size: Type.TOptional<Type.TInteger>;
        mime: Type.TOptional<Type.TString>;
        parentId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRenameFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileId: Type.TString;
        newName: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachShareFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
        expireDays: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachPreviewFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        relationId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachBatchMoveFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
        targetParentId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachBatchGetFileInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetRecycleBinList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSaveToRecycleBin: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch18-file-mgmt.d.ts.map