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
export declare const yachSearchUsers: {
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
 * ch3 - 列出知音楼内置 AI 机器人
 */
export declare const yachGetUserCard: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch5 - 列邮箱文件夹（真调，网易企业邮）*/
export declare const yachListDepts: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        parentDeptId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch5 - 搜索文档
 */
export declare const yachGetOrgUsers: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        departmentId: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
        page: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch6 - 全局搜索
 */
export declare const yachSetUserInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        status: Type.TOptional<Type.TString>;
        signature: Type.TOptional<Type.TString>;
        pic: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch5 - ⭐ 在知识库建文件（写操作，需确认）*/
/** ⭐ 按 user_id 批量查用户基础信息（头像/姓名/uuid，2026-07-14）*/
export declare const yachGetUsersByIdList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userIds: Type.TArray<Type.TUnion<[Type.TString, Type.TInteger]>>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ⭐ 获取平台配置（含 decr_config_key，2026-07-14）*/
export declare const yachGetPlatformConfig: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 用户个人配置（AI助手、搜索布局等，2026-07-14）*/
export declare const yachGetUserConfig: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 企业价值观标签列表（2026-07-14）*/
export declare const yachGetValueTags: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 未来人新帖数（2026-07-14）*/
export declare const yachGetYoungNewPost: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 工作状态列表（2026-07-21）*/
export declare const yachListWorkstates: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ⭐ 激活工作状态（2026-07-21，写操作）*/
export declare const yachSetWorkstate: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        id: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch9 - 联系人/群组列表（服务端，2026-07-21）*/
export declare const yachListContacts: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        limit: Type.TOptional<Type.TNumber>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch9 - 获取工作状态详情（bsvr/workstate/info）*/
export declare const yachGetWorkstateInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        wucId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch9-org.d.ts.map