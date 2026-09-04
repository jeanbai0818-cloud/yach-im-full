export function normalizeYachInbound(message, account) {
    const senderId = typeof message.senderId === "string" ? message.senderId.trim() : "";
    const conversationId = typeof message.conversationId === "string"
        ? message.conversationId.trim()
        : "";
    if (!senderId || !conversationId)
        return null;
    const text = typeof message.content === "string" ? message.content : "";
    const eventId = typeof message.msgId === "string" && message.msgId.trim()
        ? message.msgId
        : `${conversationId}:${message.createAt ?? Date.now()}`;
    return {
        channel: "yach-im-full",
        accountId: account.accountId,
        eventId,
        chatType: message.conversationType === "2" ? "group" : "direct",
        conversationId,
        senderId,
        text,
        raw: message,
    };
}
export function logInboundPreview(message, account, logger) {
    const normalized = normalizeYachInbound(message, account);
    if (!normalized) {
        logger.warn(`[yach-im-full][${account.accountId}] inbound message missing sender/conversation id`);
        return;
    }
    logger.info(`[yach-im-full][${account.accountId}] received ${normalized.eventId} ` +
        `from ${normalized.senderId} in ${normalized.conversationId}`);
}
//# sourceMappingURL=inbound.js.map
