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
/**
 * ch6 - 全局搜索
 */
export declare const yachGlobalSearch: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        query: Type.TString;
        limit: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch6 - URL 安全检查（com694/internal/urlcheck，只读）*/
export declare const yachCheckUrlSafety: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        url: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** ch6 - 直播列表 */
export declare const yachListLives: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        history: Type.TOptional<Type.TBoolean>;
        page: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/**
 * ch1 - 发卡片/富文本消息（Markdown，已实测可渲染，type=15）
 * 适合发带格式的通知卡片。
 */
/** ⭐ 链接预览（2026-07-21）*/
export declare const yachFetchLinkPreview: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        url: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch6-search.d.ts.map