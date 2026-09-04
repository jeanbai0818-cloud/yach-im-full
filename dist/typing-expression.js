/**
 * User-verified Yach IM expression names. Keep the built-in list restricted to
 * this allowlist: an unknown expression name makes the processing indicator
 * invisible even when the API request itself succeeds.
 */
const SUPPORTED_EXPRESSIONS = [
    "[推眼镜]",
    "[暗中观察]",
    "[拿捏]",
    "[哇]",
    "[爱你呦]",
    "[我收到了]",
    "[请稍等]",
    "[荧光棒]",
    "[鞠躬]",
    "[收到]",
    "[全力以赴]",
    "[Yes]",
    "[OpenClaw]",
];
// Keep the scene-specific pools small enough to feel intentional while using
// only the verified names above. Direct chats get the full variety; commands,
// media, and groups use the subset that best matches the moment.
const DEFAULT_EXPRESSIONS = {
    command: ["[推眼镜]", "[暗中观察]", "[拿捏]", "[全力以赴]", "[Yes]", "[OpenClaw]"],
    media: ["[哇]", "[我收到了]", "[请稍等]", "[荧光棒]", "[收到]"],
    group: ["[暗中观察]", "[哇]", "[爱你呦]", "[鞠躬]", "[收到]", "[OpenClaw]"],
    direct: SUPPORTED_EXPRESSIONS,
};
const MEDIA_MESSAGE_TYPES = new Set(["image", "audio", "video", "file"]);
const lastExpressionByScope = new Map();
function nonEmptyStrings(value) {
    if (!Array.isArray(value))
        return [];
    return value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
}
export function resolveYachExpressionScene(params) {
    if ((params.rawBody ?? "").trimStart().startsWith("/"))
        return "command";
    if (MEDIA_MESSAGE_TYPES.has(params.msgtype ?? ""))
        return "media";
    return params.isGroup ? "group" : "direct";
}
function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)] ?? "";
}
/**
 * Select one expression for one turn. `typingExpression` remains an explicit
 * single-value override; an empty string deliberately disables the feature.
 * `typingExpressions` is an optional account-level override for operators who
 * want their own pool. Otherwise the safe built-in scene pool is used.
 */
export function chooseYachTypingExpression(params) {
    if (typeof params.config.typingExpression === "string") {
        return params.config.typingExpression.trim();
    }
    const configured = nonEmptyStrings(params.config.typingExpressions);
    const pool = configured.length > 0 ? configured : DEFAULT_EXPRESSIONS[params.scene];
    if (pool.length === 0)
        return "";
    const previous = params.scopeKey ? lastExpressionByScope.get(params.scopeKey) : undefined;
    const candidates = previous && pool.length > 1 ? pool.filter((item) => item !== previous) : pool;
    const selected = randomItem(candidates);
    if (params.scopeKey && selected) {
        lastExpressionByScope.set(params.scopeKey, selected);
        // Avoid retaining an unbounded number of chat scopes in a long-running
        // gateway. Randomness does not depend on this cache being complete.
        if (lastExpressionByScope.size > 512) {
            const oldest = lastExpressionByScope.keys().next().value;
            if (typeof oldest === "string")
                lastExpressionByScope.delete(oldest);
        }
    }
    return selected;
}
export function yachExpressionPoolForScene(scene) {
    return DEFAULT_EXPRESSIONS[scene];
}
//# sourceMappingURL=typing-expression.js.map