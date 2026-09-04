/**
 * 群表情管理工具
 * 对应 API: src/api/ch14-group-emot/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetGroupEmotList: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        tid: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetGroupEmotOne: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        emotId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAddGroupEmot: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sessionId: Type.TString;
        msgId: Type.TString;
        emot: Type.TString;
        currTime: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch14-group-emot.d.ts.map