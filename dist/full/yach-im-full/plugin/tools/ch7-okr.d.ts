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
export declare const yachListOkrTemplates: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
/** ch7 - 列我的 OKR（真调，okr-api）*/
export declare const yachListMyOkrs: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        view: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch7 - 看某条 OKR 详情（真调，okr-api）*/
export declare const yachGetOkrDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        id: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
/** ch7 - 列周报（我发出的，真调）*/
//# sourceMappingURL=ch7-okr.d.ts.map