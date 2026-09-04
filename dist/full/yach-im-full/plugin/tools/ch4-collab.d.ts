/**
 * 知音楼 Agent 工具集
 *
 * 工具通过 OpenClaw/知音楼服务端能力查询数据，
 * 或者直接调用 ch1-messaging 发消息。
 *
 * 工具列表：
 *   yach_send_message    — 发消息（文本/图片/文件/音视频/图文混排）
 *   yach_get_history     — 查某会话历史消息
 *   yach_list_sessions   — 列出所有会话
 *   yach_search_messages — 全文搜索消息
 *   yach_get_status      — daemon 连接状态
 */
import { Type } from "typebox";
/**
 * 构造符合 AgentToolResult 契约的结果。
 * OpenClaw 要求 content[].type 为字面量 "text"/"image"，且 details 必填。
 */
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
export declare const yachListSchedules: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        days: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch5 - 列出知识库
 */
export declare const yachCreateSchedule: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        title: Type.TString;
        start_time: Type.TUnion<[Type.TString, Type.TNumber]>;
        end_time: Type.TUnion<[Type.TString, Type.TNumber]>;
        location: Type.TOptional<Type.TString>;
        joiner: Type.TOptional<Type.TArray<Type.TString>>;
        repeat: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch4 - 删除日程（写操作，真调验证 2026-07-12）
 * 路由：913scd/schedule/events/delete
 * ⚠️ 需用 sid（列表里的字段），不是带后缀的 id；缺 scope 报 30014。
 */
export declare const yachDeleteSchedule: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sid: Type.TString;
        scope: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRespondToSchedule: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sid: Type.TString;
        action: Type.TUnion<[Type.TLiteral<"accept">, Type.TLiteral<"reject">]>;
        reason: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch4 - 查单个日程详情（只读，真调验证 2026-07-13）
 * 路由：913scd/schedule/events/info
 */
export declare const yachGetScheduleDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        event_id: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch4 - 更新（编辑）日程（写操作，需确认）
 * 路由：先 events/info 读全字段 → 覆盖 → events/create + id（同桌面端保存编辑）
 */
export declare const yachUpdateSchedule: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        event_id: Type.TString;
        title: Type.TOptional<Type.TString>;
        start_time: Type.TOptional<Type.TUnion<[Type.TString, Type.TNumber]>>;
        end_time: Type.TOptional<Type.TUnion<[Type.TString, Type.TNumber]>>;
        joiner: Type.TOptional<Type.TArray<Type.TString>>;
        address: Type.TOptional<Type.TString>;
        remark: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch4 - 日程冲突检测（只读，真调验证 2026-07-13）
 * 路由：913scd/schedule/events/conflict
 */
export declare const yachCheckScheduleConflict: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        uids: Type.TArray<Type.TString>;
        start_time: Type.TUnion<[Type.TString, Type.TNumber]>;
        end_time: Type.TUnion<[Type.TString, Type.TNumber]>;
        event_id: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch4 - 推荐共同空闲时段（只读，真调验证 2026-07-13）
 * 路由：913scd/schedule/events/recommend/freetime
 */
export declare const yachRecommendFreetime: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        uids: Type.TArray<Type.TString>;
        start_time: Type.TUnion<[Type.TString, Type.TNumber]>;
        end_time: Type.TUnion<[Type.TString, Type.TNumber]>;
        event_id: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch8 - 获取提醒列表
 */
export declare const yachListWorkbenchApps: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        query: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch4 - 会议室预约（订会议室）入口（真调） */
export declare const yachGetMeetingRoomEntry: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch4 - 搜索空闲会议室（真调，huiyi.tal.com SSO）*/
export declare const yachSearchMeetingRooms: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        date: Type.TString;
        start: Type.TString;
        end: Type.TString;
        office: Type.TString;
        city: Type.TOptional<Type.TString>;
        keyword: Type.TOptional<Type.TString>;
        workstation: Type.TOptional<Type.TString>;
        floor: Type.TOptional<Type.TString>;
        area: Type.TOptional<Type.TString>;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch4 - 查会议室占用（真调）*/
export declare const yachMeetingRoomBookings: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        roomQuery: Type.TString;
        date: Type.TString;
        office: Type.TOptional<Type.TString>;
        city: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch4 - 预订会议室（写操作，真调）*/
export declare const yachBookMeetingRoom: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        date: Type.TString;
        start: Type.TString;
        end: Type.TString;
        roomQuery: Type.TString;
        title: Type.TString;
        office: Type.TString;
        city: Type.TOptional<Type.TString>;
        remark: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch4 - 取消会议室预订（写操作，真调）*/
export declare const yachCancelMeetingRoom: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        meetingId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
/** ch7 - 列 OKR 周期模板（真调，okr-api）*/
//# sourceMappingURL=ch4-collab.d.ts.map