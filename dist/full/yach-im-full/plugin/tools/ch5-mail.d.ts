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
/** ch5 - 列邮箱文件夹（真调，网易企业邮）*/
export declare const yachListMailFolders: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch5 - 列邮件（真调）*/
/** ch5 - 列邮件（真调）*/
export declare const yachListMailMessages: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        folderId: Type.TOptional<Type.TInteger>;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch5 - 读邮件详情（真调）*/
/** ch5 - 读邮件详情（真调）*/
export declare const yachReadMailMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        messageId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch5 - 发邮件（写操作，真调）*/
/** ch5 - 发邮件（写操作，真调）*/
export declare const yachSendMail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        subject: Type.TString;
        content: Type.TString;
        cc: Type.TOptional<Type.TString>;
        attachments: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch5 - 撤回已发送邮件（高风险写操作，需单独确认）*/
export declare const yachRecallMail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        messageId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
/**
 * ch9 - 查下级部门（组织架构）
 */
//# sourceMappingURL=ch5-mail.d.ts.map