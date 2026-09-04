/**
 * 知音楼 Agent 工具集
 *
 * 工具通过 OpenClaw/知音楼服务端能力查询数据，
 * 或者直接调用 ch1-messaging 发消息。
 *
 * 工具列表：
 *   yach_send_message    — 发消息（文本/图片/文件/音视频/图文混排）
 *   yach_get_history     — 查某会话历史消息
 *   yach_list_sessions   — 列出所有会话
 *   yach_search_messages — 全文搜索消息
 *   yach_get_status      — daemon 连接状态
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
function writeToolResult(text) {
    return toolResult(`${text}\n操作已经执行，必须向用户明确回复本次结果；不得返回 NO_REPLY，也不得为同一请求再次执行。`);
}
// ── 工具工厂 ─────────────────────────────────────────────────
/**
 * 发消息
 * 文本直接传 text；媒体消息传本地文件绝对路径。
 */
/** ch5 - 列邮箱文件夹（真调，网易企业邮）*/
export const yachListMailFolders = {
    name: "yach_list_mail_folders",
    label: "列邮箱文件夹",
    description: "列出企业邮箱的文件夹（收件箱/草稿/已发送等，含邮件数与未读数）。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const r = await ch5.listMailFolders({});
        const lines = r.folders.map((f) => `• ${f.name} (id=${f.id}, ${f.messageCount}封, 未读${f.unreadMessageCount})`);
        return toolResult(`邮箱 ${r.email}\n${lines.join("\n")}`);
    },
};
/** ch5 - 列邮件（真调）*/
/** ch5 - 列邮件（真调）*/
export const yachListMailMessages = {
    name: "yach_list_mail_messages",
    label: "列邮件",
    description: "列出某文件夹的邮件（含主题/发件人/时间）。folderId 默认 1(收件箱)，可从 yach_list_mail_folders 查。只读。",
    parameters: Type.Object({
        folderId: Type.Optional(Type.Integer({ description: "文件夹 id，默认 1=收件箱" })),
        limit: Type.Optional(Type.Integer({ description: "条数，默认 20，最大 100", default: 20, minimum: 1, maximum: 100 })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const r = await ch5.listMailMessages({ folderId: params.folderId ?? 1, limit: params.limit ?? 20 });
        const lines = r.messages.map((m) => `• [${m.messageId}] ${(m.subject || "(无主题)").slice(0, 50)}\n  ${m.from} | ${m.receivedAt || m.sentAt}`);
        return toolResult(`文件夹 ${r.folderId} 共返 ${r.returned} 封\n${lines.join("\n") || "(空)"}`);
    },
};
/** ch5 - 读邮件详情（真调）*/
/** ch5 - 读邮件详情（真调）*/
export const yachReadMailMessage = {
    name: "yach_read_mail_message",
    label: "读邮件详情",
    description: "读单封邮件详情（含正文）。messageId 从 yach_list_mail_messages 获取。只读。",
    parameters: Type.Object({
        messageId: Type.String({ description: "邮件 id" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const d = await ch5.readMailMessage({ messageId: params.messageId });
        return toolResult(`主题: ${d.subject}\n发件: ${d.from}\n收件: ${d.to}\n时间: ${d.sentAt}\n附件: ${d.attachmentCount}\n\n${d.content}`);
    },
};
/** ch5 - 发邮件（写操作，真调）*/
/** ch5 - 发邮件（写操作，真调）*/
export const yachSendMail = {
    name: "yach_send_mail",
    label: "发送邮件",
    description: "发送企业邮件（写操作，真实投递）。⚠️ 会真实发出，务必先确认收件人/主题/正文。" +
        "to 多个用 ; 或换行分隔；attachments 传本地文件绝对路径（可选）。",
    parameters: Type.Object({
        to: Type.String({ description: "收件人邮箱，多个用 ; 或换行分隔" }),
        subject: Type.String({ description: "邮件主题" }),
        content: Type.String({ description: "正文（纯文本）" }),
        cc: Type.Optional(Type.String({ description: "抄送（可选，多个用 ; 分隔）" })),
        attachments: Type.Optional(Type.String({ description: "附件本地绝对路径（可选，多个用 ; 分隔）" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const r = await ch5.sendMailText(params);
        return writeToolResult(`✅ ${r.message}\n收件人: ${r.to.join(", ")}\n主题: ${r.subject}` +
            (r.tid ? `\ntid=${r.tid}` : "") +
            (r.verifiedMessageId ? `\n已发送邮件ID=${r.verifiedMessageId}` : "") +
            `\n发送参数: action=${r.debug.action}, saveSentCopy=${r.debug.saveSentCopy}, 已发送文件夹验证=${r.verified ? "通过" : "未通过"}` +
            (r.uploadedAttachments.length ? "\n附件: " + r.uploadedAttachments.map((a) => a.name).join(", ") : ""));
    },
};
/** ch5 - 撤回已发送邮件（高风险写操作，需单独确认）*/
export const yachRecallMail = {
    name: "yach_recall_mail",
    label: "撤回企业邮件",
    description: "撤回一封已发送邮件（Coremail mbox:recallMessage，参数必须是 mid）。" +
        "撤回会影响收件人邮箱，执行前必须针对本次邮件单独确认。" +
        "撤回不会删除发件人“已发送”文件夹中的副本；已读邮件可能无法撤回。",
    parameters: Type.Object({
        messageId: Type.String({
            description: "已发送邮件的 mid；从 yach_list_mail_messages(folderId=已发送文件夹ID) 获取",
        }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch5 = require("../../api/ch5-docs/index.js");
        const r = await ch5.recallMail({ messageId: params.messageId });
        return writeToolResult(`📋 邮件撤回结果\n邮件ID: ${r.messageId}\n${r.message}\n` +
            "注意：撤回不会删除“已发送”文件夹中的本地副本。");
    },
};
/**
 * ch9 - 查下级部门（组织架构）
 */
//# sourceMappingURL=ch5-mail.js.map