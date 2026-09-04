/**
 * 知音楼 Agent 工具集 — 直播字幕
 *
 * 调用 API: ../../api/ch35-aiimage/index.js
 *
 * 工具列表：
 *   yachAddLiveSubtitle — 添加直播字幕
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachAddLiveSubtitle: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        liveId: Type.TString;
        content: Type.TString;
        startTime: Type.TOptional<Type.TInteger>;
        endTime: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch35-subtitles.d.ts.map