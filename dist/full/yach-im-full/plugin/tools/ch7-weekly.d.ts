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
export declare const yachListWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 我接收的周报（他人发给我的）—— 真调验证 2026-07-13 */
export declare const yachListReceivedWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 我的周报收到的互动动态（谁点赞/评论了）—— 真调验证 2026-07-13 */
export declare const yachListWeeklyEvents: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - 周报周期列表（真调验证 2026-07-13） */
export declare const yachListWeeklyWeeks: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 周报模板类型（真调验证 2026-07-13）*/
export declare const yachListWeeklyTemplates: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 读周报草稿（真调验证 2026-07-13）*/
export declare const yachGetWeeklyDraft: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        templateType: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 上次发送的周报（真调验证 2026-07-13）*/
export declare const yachGetLastSentWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        templateType: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 当前周期时间（真调验证 2026-07-13）*/
export declare const yachGetWeeklyTime: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 上报对象列表（真调验证 2026-07-13）*/
export declare const yachListReportEmployees: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - ⭐⭐ 按指定人查周报（真分页，真调验证 2026-07-13）*/
export declare const yachSearchUserWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userIds: Type.TArray<Type.TString>;
        page: Type.TOptional<Type.TNumber>;
        size: Type.TOptional<Type.TNumber>;
        unReadOnly: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 周报查看权限校验（真调验证 2026-07-13）*/
export declare const yachCheckWeeklyAuthority: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 给周报评论（写操作，需确认）*/
export declare const yachCommentWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
        comment: Type.TString;
        replyToId: Type.TOptional<Type.TString>;
        replyToName: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 删除周报评论（写操作，需确认）*/
export declare const yachDeleteWeeklyComment: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
        commentId: Type.TUnion<[Type.TString, Type.TNumber]>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 上报对象分类（只读）*/
export declare const yachListReportCategory: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string): Promise<ToolResult>;
};
/** ch7 - ⭐ 标记周报已读（写操作，轻量）*/
export declare const yachMarkWeeklyRead: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 关注某人周报（写操作，需确认）*/
export declare const yachFollowUserWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 取消关注（写操作，需确认）*/
export declare const yachUnfollowUserWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 存草稿/发送周报（写操作，需确认）*/
export declare const yachSaveWeeklyDraft: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        templateType: Type.TString;
        draftRevision: Type.TString;
        sectionUpdates: Type.TArray<Type.TObject<{
            title: Type.TOptional<Type.TString>;
            krId: Type.TOptional<Type.TUnion<[Type.TString, Type.TNumber]>>;
            period: Type.TOptional<Type.TUnion<[Type.TLiteral<"current">, Type.TLiteral<"next">]>>;
            content: Type.TString;
            contentFull: Type.TOptional<Type.TString>;
            includeKr: Type.TOptional<Type.TBoolean>;
        }>>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 周报发送准备（只读，不发送） */
export declare const yachPrepareWeeklySend: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        templateType: Type.TString;
        draftRevision: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 真正提交周报（不可逆，一次性） */
export declare const yachSubmitWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sendToken: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 周报详情（真调）*/
export declare const yachGetWeeklyDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 给周报点赞（写操作）*/
export declare const yachZanWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 取消周报点赞（写，真调验证 cancelzan→200）*/
export declare const yachCancelWeeklyZan: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 某周报点赞人列表（读，真调验证）*/
export declare const yachGetWeeklyZanList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 某周报评论列表（读）*/
export declare const yachGetWeeklyComments: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 批量查多篇周报点赞/已读状态（读，真调验证 readzan/list）*/
export declare const yachGetWeeklyZanReadBatch: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logIds: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 未读周报列表（读）*/
export declare const yachListUnreadWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch9 - 用户名片（个人卡片完整数据，真调）*/
export declare const yachGetWeeklyReaders: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        logId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 我收藏的周报列表（mystarlist，无参，true-tested 2026-07-13）*/
export declare const yachListStarWeekly: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch8 - ⭐ 查询提醒配额（真调验证：{message:1000,phone:1000}，2026-07-13）*/
/** ⭐ 考勤状态（com694/attendance/info，2026-07-14）*/
export declare const yachGetAttendanceInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 检查工资条 admin_token（仅使用显式受控配置）*/
export declare const yachRefreshPayrollToken: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 查工资条（当月/翻页）*/
export declare const yachGetPayroll: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TUnion<[Type.TLiteral<"C">, Type.TLiteral<"P">, Type.TLiteral<"N">]>>;
        calId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ⭐ 批量查历史工资条（自动翻页）*/
export declare const yachGetPayrollHistory: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        months: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch7-weekly.d.ts.map
