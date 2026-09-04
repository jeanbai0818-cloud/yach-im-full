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
export declare const yachSearchGroups: {
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
 * ch4 - 查询未来N天日程
 */
export declare const yachGetGroupUsers: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 群详情（需已加入该群） */
export declare const yachGetGroupInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 话题群/频道内容列表 */
export declare const yachListSquads: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        squadId: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 建群（写） */
export declare const yachCreateGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        name: Type.TString;
        members: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 群加人（写） */
export declare const yachAddGroupUsers: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        accids: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 编辑群信息/改群名（写） */
export declare const yachEditGroupInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        name: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 踢人（写） */
export declare const yachRemoveGroupUsers: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        accids: Type.TArray<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 转让群主（写） */
export declare const yachChangeGroupOwner: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        newOwnerAccid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 设/撤管理员（写） */
export declare const yachSetGroupAdmin: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        accids: Type.TArray<Type.TString>;
        set: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 全员禁言开关（写） */
export declare const yachMuteGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
        mute: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 退群（写） */
export declare const yachQuitGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch2 - 解散群（写） */
export declare const yachDismissGroup: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
/** ch3 - 搜索 AI 助手历史（真调通，95search/search/aide） */
//# sourceMappingURL=ch2-groups.d.ts.map