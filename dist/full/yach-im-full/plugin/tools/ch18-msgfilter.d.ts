/**
 * 知音楼 Agent 工具集 — 消息过滤
 *
 * 调用 API: ../../api/ch27-msgfilter/index.js
 *
 * 工具列表：
 *   yachGetSensitiveWordsConfig — 敏感词配置
 *   yachQuerySensitiveMsgs      — 敏感消息查询
 *   yachDeleteUserDbUpload      — 删除上传（写）
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetSensitiveWordsConfig: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachQuerySensitiveMsgs: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        keyword: Type.TOptional<Type.TString>;
        startDate: Type.TOptional<Type.TString>;
        endDate: Type.TOptional<Type.TString>;
        page: Type.TOptional<Type.TInteger>;
        pagesize: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteUserDbUpload: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        deviceId: Type.TString;
        delTimetag: Type.TInteger;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch18-msgfilter.d.ts.map