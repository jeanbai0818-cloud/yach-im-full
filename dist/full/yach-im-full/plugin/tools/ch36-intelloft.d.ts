/** 知小楼（Intelloft）H5 会话工具，迁移自 yach-aio 2.1.5。 */
import { Type } from "typebox";
type ToolResult = {
    content: {
        type: "text";
        text: string;
    }[];
    details: unknown;
};
export declare const yachListIntelloftSkills: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachCreateIntelloftSession: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachListIntelloftSessions: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        size: Type.TOptional<Type.TInteger>;
        lastTime: Type.TOptional<Type.TString>;
        all: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetIntelloftSession: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAskIntelloft: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        question: Type.TString;
        chatSessionId: Type.TOptional<Type.TString>;
        model: Type.TOptional<Type.TString>;
        deepThinking: Type.TOptional<Type.TBoolean>;
        networking: Type.TOptional<Type.TBoolean>;
        tool: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachIntelloftImageOcr: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        imageUrl: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteIntelloftSession: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRenameIntelloftSession: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
        title: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachTopIntelloftSession: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
        isTop: Type.TOptional<Type.TBoolean>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachContinueIntelloftChat: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachStopIntelloftMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        recordId: Type.TString;
        msgId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachRegenerateIntelloftMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
        recordId: Type.TString;
        msgId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftMessages: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
        size: Type.TOptional<Type.TInteger>;
        lastTime: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachFeedbackIntelloftMessage: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        msgId: Type.TString;
        feedbackType: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
        tags: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftFeedbackTags: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachConvertIntelloftFile: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileUrl: Type.TString;
        fileName: Type.TOptional<Type.TString>;
        fileType: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachIntelloftConvertProgress: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        taskId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftAgentSkills: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        size: Type.TOptional<Type.TInteger>;
        lastTime: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftAgentSkillCategories: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachSearchIntelloftAgentSkills: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        keyword: Type.TString;
        size: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftQuickAgentSkills: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachCreateIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillName: Type.TString;
        description: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
        categoryId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUpdateIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
        skillName: Type.TOptional<Type.TString>;
        description: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachDeleteIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachInstallIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachShareIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
        targetUsers: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachUseIntelloftAgentSkill: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
        chatSessionId: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAiseekSend: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        question: Type.TString;
        sessionId: Type.TOptional<Type.TString>;
        model: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachAiseekContinue: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        sessionId: Type.TString;
        question: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftDigitalPartners: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachSearchIntelloftGroupUsers: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        keyword: Type.TString;
        size: Type.TOptional<Type.TInteger>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftHelpwriteTags: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachGetIntelloftTmpDownloadUrl: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        fileId: Type.TOptional<Type.TString>;
        fileUrl: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachReadIntelloftNotification: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        notificationId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachListIntelloftOptions: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachChangeIntelloftOption: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        optionKey: Type.TString;
        optionValue: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetIntelloftUrlInfo: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        url: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachGetIntelloftUserGuide: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachListIntelloftVersionHistory: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{}>;
    execute(): Promise<ToolResult>;
};
export declare const yachGetIntelloftSkillDetail: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        skillId: Type.TString;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export declare const yachSendIntelloftGroupSummary: {
    name: string;
    label: string;
    description: string;
    parameters: Type.TObject<{
        chatSessionId: Type.TString;
        userIds: Type.TOptional<Type.TString>;
        content: Type.TOptional<Type.TString>;
    }>;
    execute(_id: string, params: any): Promise<ToolResult>;
};
export {};
//# sourceMappingURL=ch36-intelloft.d.ts.map