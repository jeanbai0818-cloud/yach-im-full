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
export declare const yachListAiRobots: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch2 - 查群成员（需已加入该群）
 */
export declare const yachSearchAssistantHistory: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        query: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 搜索 AI 助手列表（2026-07-21）*/
export declare const yachSearchAiRobots: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        keyword: Type.TString;
        limit: Type.TOptional<Type.TNumber>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch4 - 工作台应用列表（真调，95search/app/user/list） */
export declare const yachListPrompts: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        robotId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 语音转文字（知音楼自带能力，云信 NIM audioToText）
 * 传音频 url（消息里的 file.url），或由 ch1 工具传 sessionId+msgId 按需从云端历史定位。
 * 不需模型/不下载，走 daemon 现有 NIM 长连接。
 */
/** ch3 - 系统内置 aide 助手列表（2026-07-21）*/
export declare const yachListAideBots: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        limit: Type.TOptional<Type.TNumber>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 获取 prompt 详情（619_api/airobot/prompt/detail）*/
export declare const yachGetPromptDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        promptId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 新建 prompt（619_api/airobot/prompt/add）*/
export declare const yachAddPrompt: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        robotId: Type.TString;
        title: Type.TString;
        content: Type.TString;
        open: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 编辑 prompt（619_api/airobot/prompt/edit）*/
export declare const yachEditPrompt: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        promptId: Type.TString;
        title: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
        open: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 删除 prompt（619_api/airobot/prompt/del）*/
export declare const yachDelPrompt: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        promptId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 获取负反馈标签列表（619_api/tag/list）*/
export declare const yachGetDownvoteTags: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        source: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 检查 AI 机器人名称是否可用（93client/airobot/name/check）*/
export declare const yachCheckRobotName: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        name: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 创建自定义 AI 机器人（93client/airobot/add）*/
export declare const yachCreateAgentRobot: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        name: Type.TString;
        desc: Type.TOptional<Type.TString>;
        modelId: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch3 - 删除自定义 AI 机器人（93client/airobot/del）*/
export declare const yachDeleteAgentRobot: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        robotId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch3-ai.d.ts.map