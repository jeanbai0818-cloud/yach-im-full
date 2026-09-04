/**
 * 日程订阅 / ICS 日历工具
 * 对应 API: src/api/ch30-schedule-subscribe/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetScheduleSubscriptionSettings: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        permission: Type.TUnion<[Type.TLiteral<0>, Type.TLiteral<1>, Type.TLiteral<2>]>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetScheduleSubscriptionSubscribers: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        scheduleId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAddScheduleShareIcs: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        url: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteScheduleShareIcs: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        icsId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetScheduleShareIcsList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachEditScheduleShareIcs: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        icsId: Type.TString;
        url: Type.TOptional<Type.TString>;
        name: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSyncScheduleShareIcs: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        icsId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachCancelScheduleShare: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        shareId: Type.TString;
        uid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch24-schedule-subscribe.d.ts.map