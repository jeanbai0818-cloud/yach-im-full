// Sender identity and delivery client are distinct: Server does not prove bot identity.
export function classifySender(msg) {
    const deliveryKind = String(msg.fromClientType || "").toLowerCase() === "server" ? "server" : "client";
    if (msg.isBot === true || msg.isRobot === true || msg.robotAccount || msg.robotInfo)
        return { senderKind: "bot", senderKindSource: "explicit_robot_metadata", deliveryKind };
    if (msg.isBot === false || msg.isRobot === false)
        return { senderKind: "human", senderKindSource: "explicit_non_robot_metadata", deliveryKind };
    return { senderKind: "unknown", senderKindSource: "no_explicit_identity", deliveryKind };
}

export async function queryHistory(fetchPage, params, signal) {
    const { limit = 20, startTime = 0, endTime = params.beforeTime ?? Date.now(), senderKind = "all", maxPages = 20 } = params;
    for (const [key, value, max] of [["limit", limit, 1000], ["maxPages", maxPages, 100]]) {
        if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${key} must be 1..${max}`);
    }
    if (!Number.isSafeInteger(startTime) || !Number.isSafeInteger(endTime) || startTime < 0 || endTime <= startTime)
        throw new Error("startTime/endTime 必须是毫秒时间戳且 startTime < endTime");
    if (!["all", "bot", "human", "unknown"].includes(senderKind)) throw new Error("Invalid senderKind");
    const messages = [], seen = new Set(), warnings = [];
    let cursor = params.lastMsgId, pageEndTime = endTime, exhausted = false, pages = 0;
    while (pages < maxPages && messages.length < limit) {
        signal?.throwIfAborted();
        const size = Math.min(100, limit - messages.length);
        const page = await fetchPage({ beginTime: startTime, endTime: pageEndTime, lastMsgId: cursor, limit: size });
        pages++;
        const sorted = [...page].sort((a, b) => Number(b.time) - Number(a.time));
        if (sorted.length === 0) { exhausted = true; break; }
        for (const msg of sorted) {
            const id = String(msg.idServer || msg.idClient || "");
            if (seen.has(id)) continue;
            seen.add(id);
            const identity = classifySender(msg);
            if (msg.time >= startTime && msg.time <= endTime && (senderKind === "all" || senderKind === identity.senderKind))
                messages.push({ ...msg, ...identity });
        }
        const next = sorted.at(-1)?.idServer;
        const oldestTime = Number(sorted.at(-1)?.time);
        if (page.length < size || !Number.isSafeInteger(oldestTime)) { exhausted = true; break; }
        const nextEndTime = oldestTime - 1;
        if (nextEndTime < startTime) { exhausted = true; break; }
        if (nextEndTime >= pageEndTime || (!next && nextEndTime === pageEndTime)) {
            warnings.push("云端分页游标未推进，查询提前停止。");
            break;
        }
        cursor = next;
        pageEndTime = nextEndTime;
    }
    if (!exhausted) warnings.push("结果受 limit/maxPages 限制或尚未确认到底；使用 nextCursor 继续，不能视为完整时间段。");
    return { source: "nim-cloud", messages, pages, exhausted, warnings, nextCursor: exhausted ? null : { startTime, endTime: pageEndTime, lastMsgId: cursor } };
}
