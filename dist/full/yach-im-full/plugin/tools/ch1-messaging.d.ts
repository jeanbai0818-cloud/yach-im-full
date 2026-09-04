/**
 * 知音楼 Agent 工具集
 *
 * 工具通过当前 NIM 长连接查询云端历史/搜索和内存会话，
 * 或者直接调用 ch1-messaging 发消息；入站消息不落本地消息库。
 *
 * 工具列表：
 *   yach_send_message    — 发 P2P 消息（文本/图片/文件/音视频/图文混排）
 *   yach_send_group_text — 发群普通文本（不带 @）
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
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
export declare const yachSendMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        scene: Type.TOptional<Type.TUnion<[Type.TLiteral<"p2p">, Type.TLiteral<"team">]>>;
        text: Type.TOptional<Type.TString>;
        file: Type.TOptional<Type.TString>;
        image: Type.TOptional<Type.TString>;
        audio: Type.TOptional<Type.TString>;
        video: Type.TOptional<Type.TString>;
        imageText: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * 查历史消息
 * 从 NIM 云端查询，需要 NIM 长连接在运行。
 */
export declare const yachGetHistory: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TOptional<Type.TString>;
        sessionId: Type.TOptional<Type.TString>;
        limit: Type.TOptional<Type.TInteger>;
        beforeTime: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * 列出当前连接内存中的会话
 */
export declare const yachListSessions: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * 全文搜索消息
 */
export declare const yachSearchMessages: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        query: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * 查询 daemon 连接状态
 */
export declare const yachGetStatus: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/**
 * ch2 - 搜索群组
 */
export declare const yachSendCard: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        scene: Type.TOptional<Type.TUnion<[Type.TLiteral<"p2p">, Type.TLiteral<"team">]>>;
        title: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
        url: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 发投票（群聊专用，知音楼硬限制：投票仅支持群聊）
 * 服务端自动下发投票消息，无需手动发 NIM。
 */
export declare const yachSendVote: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        title: Type.TString;
        options: Type.TArray<Type.TString>;
        multi: Type.TOptional<Type.TBoolean>;
        days: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 发 @ 消息（群聊）
 * 支持 @指定成员 或 @全员（atAccids=["all"]）。
 */
export declare const yachSendAtMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        text: Type.TString;
        atAccids: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 撤回消息（NIM recallMsg）
 */
export declare const yachRecallMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        raw: Type.TOptional<Type.TString>;
        idServer: Type.TOptional<Type.TString>;
        idClient: Type.TOptional<Type.TString>;
        to: Type.TOptional<Type.TString>;
        scene: Type.TOptional<Type.TUnion<[Type.TLiteral<"p2p">, Type.TLiteral<"team">]>>;
        time: Type.TOptional<Type.TNumber>;
        from: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 向群发送普通文本（不带 @）
 */
export declare const yachSendGroupText: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        text: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 向群里的 AI 机器人发消息（触发机器人对话）
 * 机器人账号从 yach_list_ai_robots 获取。仅群聊有效（NIM 硬限制）。
 */
export declare const yachSendRobotMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        text: Type.TString;
        robotAccount: Type.TString;
        function: Type.TOptional<Type.TString>;
        topic: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch4 - 建日程（写操作，真调验证 2026-07-12）
 * 路由：913scd/schedule/events/create
 */
export declare const yachAudioToText: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        url: Type.TOptional<Type.TString>;
        sessionId: Type.TOptional<Type.TString>;
        msgId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch8 - 发送提醒（应用内/短信/电话）—— 知音楼"新建提醒"能力。
 * ⭐ remindType: "0"应用内(默认) / "1"短信 / "2"电话。
 * 电话提醒会真实拨打接收人手机，属高打扰写操作，需谨慎。
 */
/** ⭐ 置顶会话列表（2026-07-14）*/
export declare const yachGetTopSessions: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 消息高亮（@我/稍后处理，2026-07-14）*/
export declare const yachGetMessageHighlights: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 群未读状态（2026-07-14）*/
export declare const yachGetGroupUnread: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        groupTids: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch1-messaging.d.ts.map