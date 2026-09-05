import { extname } from "node:path";
import { chunkMarkdownText } from "openclaw/plugin-sdk/reply-runtime";
import { readLocalFileFromRoots } from "openclaw/plugin-sdk/file-access-runtime";
import { getAgentScopedMediaLocalRoots } from "openclaw/plugin-sdk/media-local-roots";
import { readRemoteMediaBuffer } from "openclaw/plugin-sdk/media-runtime";
import { resolveYachAccountByBotId, resolveYachAccount, resolveYachAccountSecrets } from "./config.js";
import { YachClient, mediaFilename, mediaKindForPath } from "./oapi.js";
import { transformModelTextToFoldLinks } from "./model-fold-links.js";
function isLikelyWorkCode(value) {
    return !/^yach-im-full/i.test(value) && !(/^\d+$/.test(value) && value.length > 6);
}
export function stripYachProviderPrefix(value) {
    return value.trim().replace(/^(?:yach-im-full|zhiyinlou):/i, "").trim();
}
export function resolveYachTarget(to) {
    const normalized = stripYachProviderPrefix(to);
    if (/^group:/i.test(normalized)) {
        const groupId = normalized.replace(/^group:/i, "").trim();
        if (!groupId)
            throw new Error("Yach IM group target is empty");
        return { toId: groupId, conversationType: "2" };
    }
    const explicitUser = /^user:/i.test(normalized);
    const raw = explicitUser ? normalized.replace(/^user:/i, "").trim() : normalized;
    if (!raw)
        throw new Error("Yach IM user target is empty");
    if (/^work_code:/i.test(normalized)) {
        const workCode = normalized.replace(/^work_code:/i, "").trim();
        if (!workCode)
            throw new Error("Yach IM work code target is empty");
        return { toId: "", conversationType: "1", toWorkCode: workCode };
    }
    return !explicitUser && isLikelyWorkCode(raw)
        ? { toId: "", conversationType: "1", toWorkCode: raw }
        : { toId: raw, conversationType: "1" };
}
function parseAtMentions(text) {
    const atMobiles = [];
    const atWorkCodes = [];
    let isAtAll = false;
    for (const match of text.matchAll(/@(\S+)/g)) {
        const id = match[1];
        if (id === "all" || id === "所有人")
            isAtAll = true;
        else if (/^1\d{10}$/.test(id))
            atMobiles.push(id);
        else if (isLikelyWorkCode(id))
            atWorkCodes.push(id);
    }
    return isAtAll || atMobiles.length || atWorkCodes.length
        ? { atMobiles, atWorkCodes, isAtAll }
        : undefined;
}
function targetResult(target, messageIds, kinds) {
    const primary = messageIds.at(-1) ?? "";
    const parts = messageIds.map((messageId, index) => ({
        platformMessageId: messageId,
        kind: kinds[index] === "text" ? "text" : kinds[index] === "card" ? "card" : "media",
        index,
    }));
    return {
        channel: "yach-im-full",
        messageId: primary,
        target: {
            kind: target.conversationType === "2" ? "conversation" : "chat",
            id: target.toId || target.toWorkCode || "",
        },
        receipt: {
            primaryPlatformMessageId: primary || undefined,
            platformMessageIds: messageIds,
            parts,
            sentAt: Date.now(),
        },
    };
}
function contentTypeForPath(path) {
    const typeByExtension = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".bmp": "image/bmp",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".webm": "video/webm",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".wav": "audio/wav",
        ".pdf": "application/pdf",
        ".zip": "application/zip",
    };
    return typeByExtension[extname(path).toLowerCase()] ?? "application/octet-stream";
}
const OUTBOUND_MEDIA_MAX_BYTES = 100 * 1024 * 1024;
function uniqueMediaRoots(values) {
    return [...new Set(values
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim()))];
}
function resolveOutboundMediaRoots(params) {
    const explicit = params.mediaLocalRoots;
    if (Array.isArray(explicit) && explicit.length > 0)
        return uniqueMediaRoots(explicit);
    const roots = [];
    const accessRoots = params.mediaAccess?.localRoots;
    if (Array.isArray(accessRoots))
        roots.push(...accessRoots);
    try {
        roots.push(...getAgentScopedMediaLocalRoots(params.cfg ?? {}, params.agentId));
    }
    catch {
        // Some one-shot/plugin test contexts do not carry a full Agent config.
    }
    if (params.mediaAccess?.workspaceDir)
        roots.push(params.mediaAccess.workspaceDir);
    if (params.workspaceDir)
        roots.push(params.workspaceDir);
    return uniqueMediaRoots(roots);
}
async function readMedia(mediaUrl, params) {
    if (/^https?:\/\//i.test(mediaUrl)) {
        const result = await readRemoteMediaBuffer({
            url: mediaUrl,
            maxBytes: OUTBOUND_MEDIA_MAX_BYTES,
        });
        return result.buffer;
    }
    const mediaReadFile = params.mediaAccess?.readFile ?? params.mediaReadFile;
    if (mediaReadFile)
        return mediaReadFile(mediaUrl);
    const roots = resolveOutboundMediaRoots(params);
    if (roots.length === 0) {
        throw new Error("OpenClaw 未提供当前 Agent 的授权媒体目录，拒绝读取本地媒体文件");
    }
    const result = await readLocalFileFromRoots({
        filePath: mediaUrl,
        roots,
        label: "OpenClaw outbound media roots",
        maxBytes: OUTBOUND_MEDIA_MAX_BYTES,
        hardlinks: "reject",
        symlinks: "reject",
    });
    if (!result) {
        throw new Error("媒体文件不在 OpenClaw 当前 Agent 的授权媒体目录内");
    }
    return result.buffer;
}
function resolveAccount(cfg, accountId) {
    return accountId ? resolveYachAccount(cfg, accountId) : resolveYachAccountByBotId(cfg, accountId);
}
async function sendText(params) {
    const account = await resolveYachAccountSecrets(params.cfg, resolveAccount(params.cfg, params.accountId));
    const target = resolveYachTarget(params.to);
    const client = YachClient.fromAccount(account);
    const text = transformModelTextToFoldLinks(params.text) ?? params.text;
    const messageId = await client.im.sendMessage({
        ...target,
        payload: {
            msgtype: "markdown",
            markdown: { title: text.slice(0, 50), text },
        },
        at: target.conversationType === "2" ? parseAtMentions(params.text) : undefined,
        quoteMsgId: params.replyToId ?? undefined,
    });
    return targetResult(target, messageId ? [messageId] : [], ["text"]);
}
async function sendMedia(params) {
    const account = await resolveYachAccountSecrets(params.cfg, resolveAccount(params.cfg, params.accountId));
    const target = resolveYachTarget(params.to);
    const client = YachClient.fromAccount(account);
    const ids = [];
    const kinds = [];
    if (params.text.trim()) {
        const textResult = await sendText(params);
        const textId = typeof textResult.messageId === "string" ? textResult.messageId : "";
        if (textId)
            ids.push(textId);
        kinds.push("text");
    }
    const data = await readMedia(params.mediaUrl, params);
    const filename = mediaFilename(params.mediaUrl);
    const kind = mediaKindForPath(filename, contentTypeForPath(filename));
    const cosType = kind === "file" || kind === "video" || kind === "audio" ? "file" : "image";
    const uploadedUrl = await client.cos.upload({
        filename,
        data,
        contentType: contentTypeForPath(filename),
        cosType,
    });
    let payload;
    if (kind === "image")
        payload = { msgtype: "image", image: { url: uploadedUrl, file_name: filename } };
    else if (kind === "video")
        payload = { msgtype: "video", video: { name: filename, url: uploadedUrl } };
    else if (kind === "audio")
        payload = { msgtype: "audio", audio: { duration: 0, url: uploadedUrl, size: data.length } };
    else
        payload = { msgtype: "file", file: { name: filename, url: uploadedUrl, size: String(data.length) } };
    const messageId = await client.im.sendMessage({ ...target, payload, quoteMsgId: params.replyToId ?? undefined });
    if (messageId)
        ids.push(messageId);
    kinds.push(kind);
    return targetResult(target, ids, kinds);
}
function splitMarkdown(text, limit) {
    return chunkMarkdownText(text, Math.max(1, limit));
}
export const yachOutbound = {
    deliveryMode: "direct",
    chunkerMode: "markdown",
    textChunkLimit: 4_000,
    chunker: (text, limit) => splitMarkdown(text, limit),
    sendText: async (ctx) => sendText(ctx),
    sendMedia: async (ctx) => {
        if (!ctx.mediaUrl)
            throw new Error("Yach IM media delivery requires mediaUrl");
        return sendMedia({ ...ctx, mediaUrl: ctx.mediaUrl });
    },
    resolveTarget: ({ to }) => {
        try {
            return { ok: true, to: to?.trim() ?? "" };
        }
        catch (error) {
            return { ok: false, error: error instanceof Error ? error : new Error(String(error)) };
        }
    },
};
//# sourceMappingURL=outbound.js.map
