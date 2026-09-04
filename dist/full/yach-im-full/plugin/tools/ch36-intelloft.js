/** 知小楼（Intelloft）H5 会话工具，迁移自 yach-aio 2.1.5。 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const result = (value) => ({
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    details: null,
});
const api = () => require("../../api/ch36-intelloft/index.js");
export const yachListIntelloftSkills = {
    name: "yach_list_intelloft_skills",
    label: "列出知小楼技能",
    description: "列出知小楼 H5 当前可用技能。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listSkills()); },
};
export const yachCreateIntelloftSession = {
    name: "yach_create_intelloft_session",
    label: "新建知小楼会话",
    description: "新建知小楼 AI 会话，并返回会话 ID、模型列表和默认配置。会在服务端创建会话，调用前需用户确认。",
    parameters: Type.Object({}),
    async execute() { return result(await api().createSession()); },
};
export const yachListIntelloftSessions = {
    name: "yach_list_intelloft_sessions",
    label: "列出知小楼会话",
    description: "列出当前账号的知小楼 AI 会话。只读。默认返回一页（合并 top_list 与 list）；传 all=true 翻页取全部。",
    parameters: Type.Object({
        size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        lastTime: Type.Optional(Type.String({ description: "分页游标；首次不传，翻页时传入上一页返回的 nextCursor" })),
        all: Type.Optional(Type.Boolean({ default: false, description: "true 时自动翻页取全部会话（上限 500 页）" })),
    }),
    async execute(_id, params) { return result(await api().listSessions(params)); },
};
export const yachGetIntelloftSession = {
    name: "yach_get_intelloft_session",
    label: "查看知小楼会话",
    description: "读取一个知小楼 AI 会话的信息。只读。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
    }),
    async execute(_id, params) { return result(await api().getSessionInfo(params.chatSessionId)); },
};
export const yachAskIntelloft = {
    name: "yach_ask_intelloft",
    label: "询问知小楼",
    description: "向知小楼 AI 发起文本对话并等待流式回答。会在服务端创建消息；调用前需用户确认。可传已有会话 ID 保持上下文。",
    parameters: Type.Object({
        question: Type.String({ minLength: 1, description: "问题文本" }),
        chatSessionId: Type.Optional(Type.String({ description: "已有会话 ID；不传则新建" })),
        model: Type.Optional(Type.String({ description: "模型名或 unique key；不传使用推荐模型" })),
        deepThinking: Type.Optional(Type.Boolean({ default: false })),
        networking: Type.Optional(Type.Boolean({ default: false })),
        tool: Type.Optional(Type.Boolean({ default: false })),
    }),
    async execute(_id, params) { return result(await api().ask(params.question, params)); },
};
export const yachIntelloftImageOcr = {
    name: "yach_intelloft_image_ocr",
    label: "知小楼图片识别",
    description: "调用知小楼官方图片识别接口读取远程图片文字。只读；图片 URL 会发送给知音楼服务。",
    parameters: Type.Object({
        imageUrl: Type.String({ format: "uri", description: "可由知音楼服务访问的 http(s) 图片 URL" }),
    }),
    async execute(_id, params) { return result(await api().imageOcr(params.imageUrl)); },
};
// ── 会话管理 ──────────────────────────────────────────────
export const yachDeleteIntelloftSession = {
    name: "yach_delete_intelloft_session",
    label: "删除知小楼会话",
    description: "删除一个知小楼 AI 会话。写操作，删除不可恢复，调用前需用户确认本次删除目标。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
    }),
    async execute(_id, params) { return result(await api().deleteSession(params.chatSessionId)); },
};
export const yachRenameIntelloftSession = {
    name: "yach_rename_intelloft_session",
    label: "重命名知小楼会话",
    description: "修改一个知小楼会话标题。写操作，调用前需用户确认。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
        title: Type.String({ minLength: 1, description: "新标题" }),
    }),
    async execute(_id, params) { return result(await api().updateSessionTitle(params.chatSessionId, params.title)); },
};
export const yachTopIntelloftSession = {
    name: "yach_top_intelloft_session",
    label: "置顶知小楼会话",
    description: "置顶或取消置顶一个知小楼会话。写操作，调用前需用户确认。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
        isTop: Type.Optional(Type.Boolean({ default: true, description: "true 置顶，false 取消置顶" })),
    }),
    async execute(_id, params) { return result(await api().topSession(params.chatSessionId, params.isTop)); },
};
export const yachContinueIntelloftChat = {
    name: "yach_continue_intelloft_chat",
    label: "继续知小楼对话",
    description: "在一个知小楼会话上继续上次对话。会产生服务端状态，调用前需用户确认。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
    }),
    async execute(_id, params) { return result(await api().continueChat(params.chatSessionId)); },
};
// ── 消息操作 ──────────────────────────────────────────────
export const yachStopIntelloftMessage = {
    name: "yach_stop_intelloft_message",
    label: "停止知小楼生成",
    description: "停止一条正在流式生成的知小楼回答。写操作，调用前需用户确认本次停止目标。",
    parameters: Type.Object({
        recordId: Type.String({ description: "机器人消息 record_id" }),
        msgId: Type.String({ description: "机器人消息 msg_id" }),
    }),
    async execute(_id, params) { return result(await api().stopMessage(params.recordId, params.msgId)); },
};
export const yachRegenerateIntelloftMessage = {
    name: "yach_regenerate_intelloft_message",
    label: "重新生成知小楼回答",
    description: "对一条知小楼消息重新生成回答。会产生服务端状态，调用前需用户确认。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
        recordId: Type.String({ description: "原消息 record_id" }),
        msgId: Type.String({ description: "原消息 msg_id" }),
    }),
    async execute(_id, params) { return result(await api().repeatMessage(params.chatSessionId, params.recordId, params.msgId)); },
};
export const yachListIntelloftMessages = {
    name: "yach_list_intelloft_messages",
    label: "知小楼消息历史",
    description: "读取一个知小楼会话的消息历史。只读。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
        size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        lastTime: Type.Optional(Type.String({ description: "分页游标；首次不传" })),
    }),
    async execute(_id, params) { return result(await api().listMessages(params.chatSessionId, params)); },
};
export const yachFeedbackIntelloftMessage = {
    name: "yach_feedback_intelloft_message",
    label: "知小楼消息反馈",
    description: "对一条知小楼回答提交反馈。写操作，调用前需用户确认。",
    parameters: Type.Object({
        msgId: Type.String({ description: "机器人消息 msg_id" }),
        feedbackType: Type.Optional(Type.String({ description: "反馈类型，如 like/dislike" })),
        content: Type.Optional(Type.String({ description: "反馈内容" })),
        tags: Type.Optional(Type.String({ description: "反馈标签，多个用逗号分隔" })),
    }),
    async execute(_id, params) { return result(await api().feedbackMessage(params.msgId, params)); },
};
export const yachListIntelloftFeedbackTags = {
    name: "yach_list_intelloft_feedback_tags",
    label: "知小楼反馈标签",
    description: "列出知小楼消息反馈可用的标签。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listFeedbackTags()); },
};
// ── 文件转换 ──────────────────────────────────────────────
export const yachConvertIntelloftFile = {
    name: "yach_convert_intelloft_file",
    label: "知小楼文件转换",
    description: "提交一个在线文件给知小楼转换。异步操作，返回任务标识后用转换进度查询。会产生服务端状态，调用前需用户确认。",
    parameters: Type.Object({
        fileUrl: Type.String({ format: "uri", description: "可由知音楼服务访问的文件 URL" }),
        fileName: Type.Optional(Type.String({ description: "文件名" })),
        fileType: Type.Optional(Type.String({ description: "文件类型" })),
    }),
    async execute(_id, params) { return result(await api().convertFile(params)); },
};
export const yachIntelloftConvertProgress = {
    name: "yach_intelloft_convert_progress",
    label: "知小楼转换进度",
    description: "查询一次知小楼文件转换的进度。只读。",
    parameters: Type.Object({
        taskId: Type.String({ description: "转换任务 id" }),
    }),
    async execute(_id, params) { return result(await api().convertProgress(params.taskId)); },
};
// ── Agent 技能 ────────────────────────────────────────────
export const yachListIntelloftAgentSkills = {
    name: "yach_list_intelloft_agent_skills",
    label: "列出知小楼 Agent 技能",
    description: "列出知小楼 Agent 技能。只读。",
    parameters: Type.Object({
        size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
        lastTime: Type.Optional(Type.String({ description: "分页游标；首次不传" })),
    }),
    async execute(_id, params) { return result(await api().listAgentSkills(params)); },
};
export const yachListIntelloftAgentSkillCategories = {
    name: "yach_list_intelloft_agent_skill_categories",
    label: "知小楼技能分类",
    description: "列出知小楼 Agent 技能的分类。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listAgentSkillCategories()); },
};
export const yachSearchIntelloftAgentSkills = {
    name: "yach_search_intelloft_agent_skills",
    label: "搜索知小楼技能",
    description: "按关键词搜索知小楼 Agent 技能。只读。",
    parameters: Type.Object({
        keyword: Type.String({ minLength: 1, description: "搜索关键词" }),
        size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    }),
    async execute(_id, params) { return result(await api().searchAgentSkills(params.keyword, params)); },
};
export const yachGetIntelloftAgentSkill = {
    name: "yach_get_intelloft_agent_skill",
    label: "知小楼技能详情",
    description: "读取一个知小楼 Agent 技能的详情。只读。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
    }),
    async execute(_id, params) { return result(await api().getAgentSkillInfo(params.skillId)); },
};
export const yachListIntelloftQuickAgentSkills = {
    name: "yach_list_intelloft_quick_agent_skills",
    label: "知小楼快捷技能",
    description: "列出知小楼快捷 Agent 技能。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listQuickAgentSkills()); },
};
export const yachCreateIntelloftAgentSkill = {
    name: "yach_create_intelloft_agent_skill",
    label: "创建知小楼技能",
    description: "创建一个知小楼 Agent 技能。写操作，调用前需用户确认本次创建内容。",
    parameters: Type.Object({
        skillName: Type.String({ minLength: 1, description: "技能名称" }),
        description: Type.Optional(Type.String({ description: "技能描述" })),
        content: Type.Optional(Type.String({ description: "技能内容/提示词" })),
        categoryId: Type.Optional(Type.String({ description: "分类 id" })),
    }),
    async execute(_id, params) { return result(await api().createAgentSkill(params)); },
};
export const yachUpdateIntelloftAgentSkill = {
    name: "yach_update_intelloft_agent_skill",
    label: "更新知小楼技能",
    description: "更新一个知小楼 Agent 技能。写操作，调用前需用户确认本次修改内容。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
        skillName: Type.Optional(Type.String({ description: "技能名称" })),
        description: Type.Optional(Type.String({ description: "技能描述" })),
        content: Type.Optional(Type.String({ description: "技能内容/提示词" })),
    }),
    async execute(_id, params) { return result(await api().updateAgentSkill(params)); },
};
export const yachDeleteIntelloftAgentSkill = {
    name: "yach_delete_intelloft_agent_skill",
    label: "删除知小楼技能",
    description: "删除一个知小楼 Agent 技能。写操作，删除不可恢复，调用前需用户确认本次删除目标。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
    }),
    async execute(_id, params) { return result(await api().deleteAgentSkill(params.skillId)); },
};
export const yachInstallIntelloftAgentSkill = {
    name: "yach_install_intelloft_agent_skill",
    label: "安装知小楼技能",
    description: "安装一个知小楼 Agent 技能。写操作，调用前需用户确认。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
    }),
    async execute(_id, params) { return result(await api().installAgentSkill(params.skillId)); },
};
export const yachShareIntelloftAgentSkill = {
    name: "yach_share_intelloft_agent_skill",
    label: "分享知小楼技能",
    description: "分享一个知小楼 Agent 技能给其他用户。写操作，会对外产生通知，调用前需用户确认目标用户。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
        targetUsers: Type.Optional(Type.String({ description: "目标用户 id，多个用逗号分隔" })),
    }),
    async execute(_id, params) { return result(await api().shareAgentSkill(params.skillId, params)); },
};
export const yachUseIntelloftAgentSkill = {
    name: "yach_use_intelloft_agent_skill",
    label: "使用知小楼技能",
    description: "在一个知小楼会话中启用某个 Agent 技能。会产生服务端状态，调用前需用户确认。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
        chatSessionId: Type.Optional(Type.String({ description: "知小楼 chat_session_id；不传则在默认会话使用" })),
    }),
    async execute(_id, params) { return result(await api().useAgentSkill(params.skillId, params.chatSessionId)); },
};
// ── AI 搜索 ────────────────────────────────────────────────
export const yachAiseekSend = {
    name: "yach_aiseek_send",
    label: "知小楼 AI 搜索",
    description: "向知小楼 AI 搜索发送一个问题。会产生服务端状态，调用前需用户确认。",
    parameters: Type.Object({
        question: Type.String({ minLength: 1, description: "搜索问题文本" }),
        sessionId: Type.Optional(Type.String({ description: "已有搜索会话 id；不传则新建" })),
        model: Type.Optional(Type.String({ description: "模型名；不传使用默认" })),
    }),
    async execute(_id, params) { return result(await api().aiseekSend(params.question, params)); },
};
export const yachAiseekContinue = {
    name: "yach_aiseek_continue",
    label: "继续知小楼 AI 搜索",
    description: "在一个知小楼 AI 搜索会话上继续提问。会产生服务端状态，调用前需用户确认。",
    parameters: Type.Object({
        sessionId: Type.String({ description: "AI 搜索会话 id" }),
        question: Type.Optional(Type.String({ description: "追问文本" })),
    }),
    async execute(_id, params) { return result(await api().aiseekContinue(params.sessionId, params)); },
};
// ── 其他 ───────────────────────────────────────────────────
export const yachListIntelloftDigitalPartners = {
    name: "yach_list_intelloft_digital_partners",
    label: "知小楼数字伙伴",
    description: "列出知小楼数字伙伴。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listDigitalPartners()); },
};
export const yachSearchIntelloftGroupUsers = {
    name: "yach_search_intelloft_group_users",
    label: "知小楼群用户搜索",
    description: "在知小楼会话内按关键词搜索群用户。只读。",
    parameters: Type.Object({
        keyword: Type.String({ minLength: 1, description: "搜索关键词" }),
        size: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
    }),
    async execute(_id, params) { return result(await api().searchGroupUsers(params.keyword, params)); },
};
export const yachListIntelloftHelpwriteTags = {
    name: "yach_list_intelloft_helpwrite_tags",
    label: "知小楼写作标签",
    description: "列出知小楼写作助手标签。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listHelpwriteTags()); },
};
export const yachGetIntelloftTmpDownloadUrl = {
    name: "yach_get_intelloft_tmp_download_url",
    label: "知小楼临时下载地址",
    description: "获取知小楼临时文件的下载地址。只读。",
    parameters: Type.Object({
        fileId: Type.Optional(Type.String({ description: "文件 id" })),
        fileUrl: Type.Optional(Type.String({ description: "文件 URL" })),
    }),
    async execute(_id, params) { return result(await api().getTmpDownloadUrl(params)); },
};
export const yachReadIntelloftNotification = {
    name: "yach_read_intelloft_notification",
    label: "知小楼通知已读",
    description: "标记一条知小楼通知为已读。写操作，调用前需用户确认。",
    parameters: Type.Object({
        notificationId: Type.String({ description: "通知 id" }),
    }),
    async execute(_id, params) { return result(await api().readNotification(params.notificationId)); },
};
export const yachListIntelloftOptions = {
    name: "yach_list_intelloft_options",
    label: "知小楼选项列表",
    description: "列出知小楼可配置选项。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listOptions()); },
};
export const yachChangeIntelloftOption = {
    name: "yach_change_intelloft_option",
    label: "修改知小楼选项",
    description: "修改一个知小楼配置选项。写操作，调用前需用户确认本次修改键值。",
    parameters: Type.Object({
        optionKey: Type.String({ minLength: 1, description: "选项键" }),
        optionValue: Type.String({ description: "选项值" }),
    }),
    async execute(_id, params) { return result(await api().changeOption(params)); },
};
export const yachGetIntelloftUrlInfo = {
    name: "yach_get_intelloft_url_info",
    label: "知小楼 URL 信息",
    description: "查询一个 URL 在知小楼中的信息。只读；URL 会发送给知音楼服务。",
    parameters: Type.Object({
        url: Type.String({ format: "uri", description: "要查询的 URL" }),
    }),
    async execute(_id, params) { return result(await api().getUrlInfo(params.url)); },
};
export const yachGetIntelloftUserGuide = {
    name: "yach_get_intelloft_user_guide",
    label: "知小楼用户引导",
    description: "读取知小楼用户引导信息。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().getUserGuide()); },
};
export const yachListIntelloftVersionHistory = {
    name: "yach_list_intelloft_version_history",
    label: "知小楼版本历史",
    description: "列出知小楼版本历史。只读。",
    parameters: Type.Object({}),
    async execute() { return result(await api().listVersionHistory()); },
};
export const yachGetIntelloftSkillDetail = {
    name: "yach_get_intelloft_skill_detail",
    label: "知小楼技能详情（旧）",
    description: "读取一个知小楼技能的详情（旧版接口）。只读。",
    parameters: Type.Object({
        skillId: Type.String({ description: "技能 id" }),
    }),
    async execute(_id, params) { return result(await api().getSkillDetail(params.skillId)); },
};
export const yachSendIntelloftGroupSummary = {
    name: "yach_send_intelloft_group_summary",
    label: "知小楼群摘要消息",
    description: "向一个知小楼群会话发送摘要消息。写操作，会对外发送消息，调用前需用户确认目标会话与内容。",
    parameters: Type.Object({
        chatSessionId: Type.String({ description: "知小楼 chat_session_id" }),
        userIds: Type.Optional(Type.String({ description: "目标用户 id，多个用逗号分隔" })),
        content: Type.Optional(Type.String({ description: "摘要内容" })),
    }),
    async execute(_id, params) { return result(await api().sendGroupSummaryMessage(params)); },
};
//# sourceMappingURL=ch36-intelloft.js.map