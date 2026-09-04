const CARD_ROTATE_MS = 9 * 60 * 1000;
/** Small serialized live-card writer used by the direct reply dispatcher. */
export class YachStreamingCard {
    client;
    log;
    messageId;
    closed = false;
    pending = "";
    timer;
    queue = Promise.resolve();
    createdAt = 0;
    toId;
    sessionType;
    quoteMsgId;
    constructor(client, log) {
        this.client = client;
        this.log = log;
    }
    async start(toId, sessionType, quoteMsgId) {
        if (this.messageId)
            return;
        this.toId = toId;
        this.sessionType = sessionType;
        this.quoteMsgId = quoteMsgId;
        this.log?.(`[yach-im-full-stream] starting card to=${toId} session_type=${sessionType}`);
        this.messageId = await this.client.stream.createCard(toId, sessionType, quoteMsgId, this.log);
        this.createdAt = Date.now();
    }
    isActive() {
        return Boolean(this.messageId) && !this.closed;
    }
    getMessageId() {
        return this.messageId;
    }
    push(content) {
        if (!this.isActive() || !content)
            return;
        this.pending += content;
        if (this.timer)
            return;
        this.timer = setTimeout(() => {
            this.timer = undefined;
            const contentToSend = this.pending;
            this.pending = "";
            if (contentToSend)
                this.queue = this.queue.then(() => this.pushNow(contentToSend));
        }, 100);
    }
    async close(finalContent) {
        if (!this.messageId || this.closed)
            return;
        this.closed = true;
        if (this.timer)
            clearTimeout(this.timer);
        this.timer = undefined;
        const messageId = this.messageId;
        let failure;
        try {
            await this.queue;
            const remaining = this.pending + (finalContent ?? "");
            this.pending = "";
            if (remaining)
                await this.pushNow(remaining);
        }
        catch (error) {
            // Preserve the original push/create failure, but still close the native
            // card below so a failed stream cannot leave an open provider card.
            failure = error;
        }
        try {
            await this.client.stream.close(messageId, this.log);
        }
        catch (error) {
            if (!failure)
                failure = error;
            else
                this.log?.(`[yach-im-full-stream] close after prior failure also failed: ${String(error)}`);
        }
        if (failure)
            throw failure;
    }
    async pushNow(content) {
        if (!this.messageId || !content)
            return;
        if (Date.now() - this.createdAt > CARD_ROTATE_MS) {
            await this.client.stream.close(this.messageId, this.log);
            this.messageId = await this.client.stream.createCard(this.toId ?? "", this.sessionType ?? "1", this.quoteMsgId, this.log);
            this.createdAt = Date.now();
        }
        await this.client.stream.push(this.messageId, content, this.log);
    }
}
//# sourceMappingURL=streaming-card.js.map
