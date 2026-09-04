const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_MAX_ENTRIES = 5_000;
export class MessageDedup {
    ttlMs;
    maxEntries;
    entries = new Map();
    constructor(ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES) {
        this.ttlMs = ttlMs;
        this.maxEntries = maxEntries;
    }
    tryRecord(id, scope) {
        const key = `${scope}:${id}`;
        const now = Date.now();
        const previous = this.entries.get(key);
        if (previous !== undefined && now - previous < this.ttlMs)
            return false;
        if (this.entries.size >= this.maxEntries) {
            const oldest = this.entries.keys().next().value;
            if (oldest)
                this.entries.delete(oldest);
        }
        this.entries.set(key, now);
        return true;
    }
    clear() {
        this.entries.clear();
    }
}
const dedupByAccount = new Map();
export function getMessageDedup(accountId) {
    let dedup = dedupByAccount.get(accountId);
    if (!dedup) {
        dedup = new MessageDedup();
        dedupByAccount.set(accountId, dedup);
    }
    return dedup;
}
export function isMessageExpired(createAt, expiryMs = 30 * 60 * 1000) {
    if (createAt === undefined || createAt === null || createAt === "")
        return false;
    const numeric = Number(createAt);
    const timestamp = Number.isFinite(numeric)
        ? (numeric < 1_000_000_000_000 ? numeric * 1_000 : numeric)
        : typeof createAt === "string" ? Date.parse(createAt) : Number.NaN;
    return Number.isFinite(timestamp) && Date.now() - timestamp > expiryMs;
}
//# sourceMappingURL=dedup.js.map