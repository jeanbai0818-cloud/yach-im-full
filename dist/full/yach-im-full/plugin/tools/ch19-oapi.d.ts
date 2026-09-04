/**
 * 知音楼 Agent 工具集 — 开放平台
 *
 * 调用 API: ../../api/ch29-oapi/index.js
 *
 * 工具列表：
 *   yachOapiMessageSingleSend — 单发消息（写）
 *   yachOapiRobotsList        — 机器人列表
 *   yachGetOapiDetail         — 应用详情
 *   yachGetAppPushState       — 推送状态
 *   yachSetAppPush            — 推送设置（写）
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachOapiMessageSingleSend: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        receiverId: Type.TString;
        content: Type.TString;
        agentId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachOapiRobotsList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetOapiDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        appId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetAppPushState: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        appId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSetAppPush: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        appId: Type.TString;
        enabled: Type.TBoolean;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch19-oapi.d.ts.map