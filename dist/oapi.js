import { basename, extname } from "node:path";
export class YachApiError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = "YachApiError";
    }
}
const tokenCache = new Map();
const tokenInflight = new Map();
function isSuccessCode(code) {
    return code === undefined || Number(code) === 0 || Number(code) === 200;
}
function readJsonText(text) {
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" ? parsed : {};
    }
    catch {
        return {};
    }
}
async function yachFetch(url, init) {
    const response = await fetch(url, {
        ...init,
        headers: {
            "yach-version-area": "YachAreaRed",
            ...init?.headers,
        },
    });
    const text = await response.text();
    const data = readJsonText(text);
    if (!response.ok || !isSuccessCode(data.code ?? data.errcode)) {
        throw new YachApiError(`[yach-oapi] ${init?.method ?? "GET"} ${new URL(url).pathname} failed ` +
            `(HTTP ${response.status}, code ${String(data.code ?? data.errcode ?? "unknown")})`, data.code ?? data.errcode);
    }
    return { response, data, text };
}
async function getAccessToken(baseUrl, appKey, appSecret, signal) {
    const key = `${baseUrl}:${appKey}`;
    const cached = tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now())
        return cached.token;
    // A status probe may be cancelled by the host. Never let an aborted,
    // signal-bound request poison the shared token request used by a live turn.
    if (!signal) {
        const existing = tokenInflight.get(key);
        if (existing)
            return existing;
    }
    const request = (async () => {
        const url = `${baseUrl}/gettoken?appkey=${encodeURIComponent(appKey)}&appsecret=${encodeURIComponent(appSecret)}`;
        const { data } = await yachFetch(url, { signal });
        const obj = data.obj && typeof data.obj === "object" ? data.obj : {};
        const token = typeof obj.access_token === "string" ? obj.access_token : "";
        const expiresAtRaw = Number(obj.expired_time);
        if (!token || !Number.isFinite(expiresAtRaw)) {
            throw new YachApiError("[yach-oapi] gettoken returned an invalid token response", data.code);
        }
        tokenCache.set(key, {
            token,
            expiresAt: expiresAtRaw * 1000 - 3 * 60 * 1000,
        });
        return token;
    })();
    if (!signal)
        tokenInflight.set(key, request);
    try {
        return await request;
    }
    finally {
        if (!signal)
            tokenInflight.delete(key);
    }
}
function extractMessageId(data, text) {
    const match = text.match(/"yachMid"\s*:\s*(\d+)/);
    if (match)
        return match[1];
    const obj = data.obj && typeof data.obj === "object" ? data.obj : {};
    for (const value of [data.yachMid, data.msg_id, obj.yachMid, obj.msg_id, obj.message_id]) {
        if (typeof value === "string" || typeof value === "number")
            return String(value);
    }
    return undefined;
}
class YachImApi {
    client;
    constructor(client) {
        this.client = client;
    }
    async sendMessage(params) {
        const isGroup = params.conversationType === "2";
        const payload = { ...params.payload };
        if (isGroup && params.at && (params.at.isAtAll || params.at.atMobiles?.length || params.at.atWorkCodes?.length)) {
            payload.at = {
                atMobiles: params.at.atMobiles ?? [],
                atWorkCodes: params.at.atWorkCodes ?? [],
                isAtAll: params.at.isAtAll ?? false,
            };
        }
        if (params.quoteMsgId)
            payload.quote_msg_id = params.quoteMsgId;
        const token = await this.client.resolveToken();
        const path = isGroup ? "/group/robot/message/send" : "/v1/single/message/send";
        const body = new URLSearchParams({
            ...(isGroup ? { group_id: params.toId } : params.toWorkCode ? { to_work_code: params.toWorkCode } : { to_user_id: params.toId }),
            message: JSON.stringify(payload),
        });
        const { data, text } = await yachFetch(`${this.client.baseUrl}${path}?access_token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        return extractMessageId(data, text);
    }
    async recallMessage(messageId) {
        const token = await this.client.resolveToken();
        await yachFetch(`${this.client.baseUrl}/openapi/v2/msg/recall`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: token, yach_mid: messageId }),
        });
    }
    async getGroupInfo(groupId) {
        const token = await this.client.resolveToken();
        const body = new URLSearchParams({ group_tid: groupId });
        const { data } = await yachFetch(`${this.client.baseUrl}/group/info?access_token=${encodeURIComponent(token)}`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        return data.obj && typeof data.obj === "object" ? data.obj : {};
    }
}
class YachExpressionApi {
    client;
    constructor(client) {
        this.client = client;
    }
    async toggle(params) {
        const token = await this.client.resolveToken();
        const expressionSessionType = params.sessionType === "2" ? "1" : "0";
        const form = new URLSearchParams({
            access_token: token,
            session_type: expressionSessionType,
            msg_id: params.msgId,
            expression: params.expression,
            from_userid: params.fromUserId,
        });
        if (expressionSessionType === "1")
            form.set("session_id", params.sessionId);
        const path = "/message/expression/add";
        params.log?.(`[yach-oapi] >>> POST ${path} msg_id=${params.msgId} session_type=${expressionSessionType} expression=${params.expression}`);
        try {
            const { response, data } = await yachFetch(`${this.client.baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: form.toString(),
            });
            params.log?.(`[yach-oapi] <<< POST ${path} HTTP ${response.status} code=${String(data.code ?? data.errcode ?? "unknown")}`);
        }
        catch (error) {
            params.log?.(`[yach-oapi] !!! POST ${path} failed: ${String(error)}`);
            throw error;
        }
    }
}
class YachStreamApi {
    client;
    constructor(client) {
        this.client = client;
    }
    async createCard(toId, sessionType, quoteMsgId, log) {
        const token = await this.client.resolveToken();
        const body = {
            access_token: token,
            to_id: toId,
            session_type: Number(sessionType),
        };
        if (quoteMsgId)
            body.quote_msg_id = quoteMsgId;
        const path = "/openapi/v2/msg_card/create";
        log?.(`[yach-oapi] >>> POST ${path} to_id=${toId} session_type=${sessionType}`);
        try {
            const { response, data } = await yachFetch(`${this.client.baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const obj = data.obj && typeof data.obj === "object" ? data.obj : {};
            const id = obj.msg_id;
            if (typeof id !== "string" && typeof id !== "number")
                throw new YachApiError("[yach-oapi] createCard returned no message id", data.code);
            log?.(`[yach-oapi] <<< POST ${path} HTTP ${response.status} code=${String(data.code ?? data.errcode ?? "unknown")} msg_id=${String(id)}`);
            return String(id);
        }
        catch (error) {
            log?.(`[yach-oapi] !!! POST ${path} failed: ${String(error)}`);
            throw error;
        }
    }
    async push(messageId, content, log) {
        const token = await this.client.resolveToken();
        const path = "/openapi/v2/msg_content/push";
        log?.(`[yach-oapi] >>> POST ${path} msg_id=${messageId} content_len=${content.length}`);
        try {
            const { response, data } = await yachFetch(`${this.client.baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: token, msg_id: messageId, msg_content: content }),
            });
            log?.(`[yach-oapi] <<< POST ${path} HTTP ${response.status} code=${String(data.code ?? data.errcode ?? "unknown")}`);
        }
        catch (error) {
            log?.(`[yach-oapi] !!! POST ${path} failed: ${String(error)}`);
            throw error;
        }
    }
    async close(messageId, log) {
        const token = await this.client.resolveToken();
        const path = "/openapi/v2/msg_card/close";
        log?.(`[yach-oapi] >>> POST ${path} msg_id=${messageId}`);
        try {
            const { response, data } = await yachFetch(`${this.client.baseUrl}${path}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: token, msg_id: messageId }),
            });
            log?.(`[yach-oapi] <<< POST ${path} HTTP ${response.status} code=${String(data.code ?? data.errcode ?? "unknown")}`);
        }
        catch (error) {
            log?.(`[yach-oapi] !!! POST ${path} failed: ${String(error)}`);
            throw error;
        }
    }
}
class YachContactsApi {
    client;
    constructor(client) {
        this.client = client;
    }
    async getUserByWorkCode(workCode) {
        const token = await this.client.resolveToken();
        const { data } = await yachFetch(`${this.client.baseUrl}/user/get_by_workcode?access_token=${encodeURIComponent(token)}&work_code=${encodeURIComponent(workCode)}`);
        return data.obj && typeof data.obj === "object" ? data.obj : {};
    }
    async getUserById(userId) {
        const token = await this.client.resolveToken();
        const { data } = await yachFetch(`${this.client.baseUrl}/user/get?access_token=${encodeURIComponent(token)}&userid=${encodeURIComponent(userId)}`);
        return data.obj && typeof data.obj === "object" ? data.obj : {};
    }
}
class YachCosApi {
    client;
    constructor(client) {
        this.client = client;
    }
    async upload(params) {
        const token = await this.client.resolveToken();
        const { data } = await yachFetch(`${this.client.baseUrl}/open/api/sts/get?access_token=${encodeURIComponent(token)}&type=${encodeURIComponent(params.cosType)}`);
        const creds = data.obj;
        if (!creds?.credentials?.tmpSecretId || !creds.bucket || !creds.region || !creds.key || !creds.domain) {
            throw new YachApiError("[yach-oapi] media STS response is incomplete", data.code);
        }
        const cosModule = await import("cos-nodejs-sdk-v5");
        const Cos = (cosModule.default ?? cosModule);
        const cos = new Cos({
            SecretId: creds.credentials.tmpSecretId,
            SecretKey: creds.credentials.tmpSecretKey,
            SecurityToken: creds.credentials.stsToken,
        });
        const key = `${creds.key}${params.filename}`;
        await new Promise((resolve, reject) => {
            cos.putObject({
                Bucket: creds.bucket,
                Region: creds.region,
                Key: key,
                Body: params.data,
                ContentType: params.contentType,
            }, (error) => error ? reject(error) : resolve());
        });
        return `https://${creds.domain}${creds.key}${encodeURIComponent(params.filename)}`;
    }
}
export class YachClient {
    baseUrl;
    appKey;
    appSecret;
    im;
    expression;
    stream;
    contacts;
    cos;
    constructor(baseUrl, appKey, appSecret) {
        this.baseUrl = baseUrl;
        this.appKey = appKey;
        this.appSecret = appSecret;
        this.im = new YachImApi(this);
        this.expression = new YachExpressionApi(this);
        this.stream = new YachStreamApi(this);
        this.contacts = new YachContactsApi(this);
        this.cos = new YachCosApi(this);
    }
    static fromAccount(account) {
        if (!account.appKey || !account.appSecret) {
            throw new YachApiError(`[yach-im-full] account ${account.accountId} missing appKey/appSecret`);
        }
        return new YachClient(account.baseUrl, account.appKey, account.appSecret);
    }
    resolveToken(signal) {
        return getAccessToken(this.baseUrl, this.appKey, this.appSecret, signal);
    }
}
export function mediaKindForPath(path, contentType) {
    const type = contentType?.toLowerCase() ?? "";
    if (type.startsWith("image/"))
        return "image";
    if (type.startsWith("video/"))
        return "video";
    if (type.startsWith("audio/"))
        return "audio";
    const ext = extname(path).toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext))
        return "image";
    if ([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"].includes(ext))
        return "video";
    if ([".amr", ".aac", ".m4a", ".mp3", ".wav", ".ogg"].includes(ext))
        return "audio";
    return "file";
}
export function mediaFilename(path) {
    return basename(path) || "file";
}
//# sourceMappingURL=oapi.js.map
