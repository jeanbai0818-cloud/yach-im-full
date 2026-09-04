const queues = new Map();
export function enqueueChatTask(params) {
    const key = `${params.accountId}:${params.chatId}`;
    const previous = queues.get(key);
    const status = previous ? "queued" : "immediate";
    const next = (previous ?? Promise.resolve()).then(params.task, params.task);
    queues.set(key, next);
    const cleanup = () => {
        if (queues.get(key) === next)
            queues.delete(key);
    };
    next.then(cleanup, cleanup);
    return { status, promise: next };
}
//# sourceMappingURL=chat-queue.js.map