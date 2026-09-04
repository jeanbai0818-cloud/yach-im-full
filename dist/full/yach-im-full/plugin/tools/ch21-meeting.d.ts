/**
 * 腾讯会议/音视频工具
 * 对应 API: src/api/ch22-meeting/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetTencentMeetingList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetTencentMeetingInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        meetingId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetTencentMeetingSummary: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        meetingId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetTencentRecordInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        recordId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRefreshTencentToken: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachLinkMsgAbstract: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        url: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch21-meeting.d.ts.map