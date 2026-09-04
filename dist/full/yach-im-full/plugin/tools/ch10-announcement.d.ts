/**
 * 群公告 CRUD 工具
 * 对应 API: src/api/ch10-announcement/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetGroupAnnouncements: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetGroupAnnouncementDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        announcementId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachCreateGroupAnnouncement: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        title: Type.TString;
        content: Type.TString;
        top: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUpdateGroupAnnouncement: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        announcementId: Type.TString;
        title: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
        top: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteGroupAnnouncement: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        announcementId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSetGroupAnnouncementTop: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        announcementId: Type.TString;
        top: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetGroupAnnouncementCheck: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        announcementId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch10-announcement.d.ts.map