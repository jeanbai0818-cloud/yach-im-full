/**
 * 知音楼 Agent 工具集 — 投票详情
 *
 * 调用 API: ../../api/ch31-vote/index.js
 *
 * 工具列表：
 *   yachGetVoteDetail    — 投票详情
 *   yachAddVoteChoice    — 选择答案（写）
 *   yachGetVoteCount     — 投票计数
 *   yachIntelloftVote    — 投票（写）
 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachGetVoteDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        voteId: Type.TString;
        msgId: Type.TOptional<Type.TString>;
        sessionId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAddVoteChoice: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        voteId: Type.TString;
        choiceIds: Type.TArray<Type.TString>;
        teamId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetVoteCount: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        uniq: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachIntelloftVote: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        to: Type.TString;
        title: Type.TString;
        options: Type.TArray<Type.TString>;
        multi: Type.TOptional<Type.TBoolean>;
        days: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch21-vote.d.ts.map