/**
 * 侧栏配置工具
 * 对应 API: src/api/ch16-sidebar/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetSideBarConf: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(_id: string, _params: any): Promise<ToolResult>;
};
export declare const yachSetSideBarConf: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        config: Type.TUnion<[Type.TString, Type.TObject<{}>]>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAddSideBarNav: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        appId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDelSideBarNav: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        appId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch16-sidebar.d.ts.map