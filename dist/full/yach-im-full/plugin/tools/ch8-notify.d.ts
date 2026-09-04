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
export declare const yachListReminders: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch8 - 确认/已读一条提醒（写操作）*/
export declare const yachConfirmRemind: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        feedId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch8 - 撤回我发的提醒（写操作）*/
export declare const yachRecallRemind: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        rid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch9 - 搜索用户
 */
export declare const yachSendRemind: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        content: Type.TString;
        uids: Type.TArray<Type.TString>;
        remindType: Type.TOptional<Type.TString>;
        msgId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - ⭐ 周报已读人列表（真调验证：字段 name/workCode/at，2026-07-13）*/
export declare const yachGetRemindQuota: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch8 - 提示栏活动通知（正在进行的会议/直播，2026-07-21）*/
export declare const yachGetPromptBar: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export {};
/** ch9 - ⭐ 设置个人状态/签名（写操作，需确认）*/
//# sourceMappingURL=ch8-notify.d.ts.map