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
export declare const yachListLoreSpaces: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        reqType: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 薪火知识库目录树（617lorebase/space/sidenodes） */
export declare const yachLoreSidenodes: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeIds: Type.TOptional<Type.TArray<Type.TString>>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 在薪火知识库中新增节点/文档（617lorebase/space/node/add） */
export declare const yachLoreNodeAdd: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        parentNodeId: Type.TOptional<Type.TString>;
        nodeType: Type.TString;
        name: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 重命名薪火知识库节点（617lorebase/space/node/edit/name） */
export declare const yachLoreNodeRename: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
        name: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 移动薪火知识库节点（617lorebase/space/node/drag） */
export declare const yachLoreNodeDrag: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
        parentNodeId: Type.TOptional<Type.TString>;
        targetNodeId: Type.TOptional<Type.TString>;
        targetNodeIndex: Type.TOptional<Type.TInteger>;
        originParentId: Type.TOptional<Type.TString>;
        originNodeIndex: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 删除薪火知识库节点（617lorebase/space/node/del） */
export declare const yachLoreNodeDelete: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
        all: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 知识库成员权限列表 */
export declare const yachLoreSpaceAuthList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 添加知识库成员权限 */
export declare const yachLoreSpaceAuthAdd: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        userId: Type.TInteger;
        auth: Type.TInteger;
        type: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 修改知识库成员权限 */
export declare const yachLoreSpaceAuthEdit: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        userId: Type.TInteger;
        auth: Type.TInteger;
        type: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 删除知识库成员权限 */
export declare const yachLoreSpaceAuthDel: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        userId: Type.TInteger;
        type: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 节点协作者列表 */
export declare const yachLoreNodeCollaboratorsList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 添加节点协作者 */
export declare const yachLoreNodeCollaboratorsAdd: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
        userId: Type.TInteger;
        auth: Type.TInteger;
        type: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 删除节点协作者 */
export declare const yachLoreNodeCollaboratorsDel: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
        userId: Type.TInteger;
        type: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 修改节点协作者权限等级 */
export declare const yachLoreNodeCollaboratorsEdit: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
        userId: Type.TInteger;
        auth: Type.TInteger;
        type: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 节点分享配置（可选范围） */
export declare const yachLoreNodeShareGetConf: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 节点当前分享状态 */
export declare const yachLoreNodeShareGetContentConf: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 设置节点分享状态 */
export declare const yachLoreNodeShareSetContentConf: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        guid: Type.TString;
        rangeKey: Type.TInteger;
        rangeAuthKey: Type.TInteger;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 通过新版 625doc 接口新建普通文档/文件夹 */
export declare const yachCreateClientDocument: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        name: Type.TString;
        type: Type.TOptional<Type.TUnion<[Type.TLiteral<"newdoc">, Type.TLiteral<"folder">]>>;
        parentGuid: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 节点安全权限列表 */
export declare const yachLoreNodeSecurityList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 节点详情 */
export declare const yachLoreNodeInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        topicId: Type.TString;
        nodeId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 上传本地文件到知识库 folder（sign→COS→save，真调打通 2026-07-20）*/
export declare const yachLoreUploadFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        folderGuid: Type.TString;
        filePath: Type.TString;
        fileName: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 读取薪火知识库文档正文（Markdown），HTTP/2 + 25doc SSO，2026-07-21 真调通 */
export declare const yachLoreReadDoc: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        guid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
/** 写入薪火知识库文档正文（Markdown 替换全文），HTTP/2 + 25doc SSO，2026-07-21 真调通 */
export declare const yachLoreWriteDoc: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        guid: Type.TString;
        content: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
/** ch7 - ⭐ 周报已读人列表（真调验证：字段 name/workCode/at，2026-07-13）*/
//# sourceMappingURL=ch5-docs.d.ts.map