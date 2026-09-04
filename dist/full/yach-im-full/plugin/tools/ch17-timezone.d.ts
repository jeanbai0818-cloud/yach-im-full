/**
 * 知音楼 Agent 工具集 — 时区管理
 *
 * 调用 API: ../../api/ch26-timezone/index.js
 *
 * 工具列表：
 *   yachGetTimezoneList        — 时区列表
 *   yachSaveTimezone           — 保存时区（写）
 *   yachGetSupportTimezoneList — 支持时区列表
 *   yachDeleteTimezone         — 删除时区（写）
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetTimezoneList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachSaveTimezone: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        timezone: Type.TString;
        identifier: Type.TOptional<Type.TString>;
        isCustom: Type.TOptional<Type.TUnion<[Type.TLiteral<0>, Type.TLiteral<1>]>>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetSupportTimezoneList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachDeleteTimezone: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        timezoneId: Type.TInteger;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch17-timezone.d.ts.map