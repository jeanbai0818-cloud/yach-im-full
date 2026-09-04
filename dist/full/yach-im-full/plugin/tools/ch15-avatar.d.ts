/**
 * 头像管理工具
 * 对应 API: src/api/ch15-avatar/index.js
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetAvatarInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        userId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUploadAvatar: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        filePath: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch15-avatar.d.ts.map