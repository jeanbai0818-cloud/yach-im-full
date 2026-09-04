import { defineChannelPluginEntry } from "openclaw/plugin-sdk/channel-core";
import { yachPlugin } from "../dist/channel-plugin.js";
import { setYachRuntime } from "../dist/plugin-runtime.js";
import { registerFullRuntime } from "../dist/full-runtime.js";
export default defineChannelPluginEntry({
    id: "yach-im-full",
    name: "Yach IM Full",
    description: "知音楼企业 IM 聊天通道 + NIM 登录长连接",
    plugin: yachPlugin,
    setRuntime: setYachRuntime,
    configSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
            sessionPath: { type: "string", description: "可选：yach-im-full session.json 的绝对路径" },
            nimEnabled: { type: "boolean", default: true },
            autoStartNim: { type: "boolean", default: true },
            responsePolicy: {
                type: "object",
                additionalProperties: false,
                properties: {
                    enabled: { type: "boolean", default: false },
                    p2pAllow: { type: "array", items: { type: "string" } },
                    groupAlways: { type: "array", items: { type: "string" } },
                    groupMention: { type: "array", items: { type: "string" } },
                    agentId: { type: "string" },
                    model: { type: "string" },
                    timeoutMs: { type: "integer", minimum: 5000, maximum: 120000 },
                    maxConcurrent: { type: "integer", minimum: 1, maximum: 8 },
                    queueLimit: { type: "integer", minimum: 1, maximum: 200 },
                    maxReplyChars: { type: "integer", minimum: 200, maximum: 20000 },
                    respondToOffline: { type: "boolean" },
                    respondToBots: { type: "boolean" },
                },
            },
        },
    },
    registerFull: registerFullRuntime,
});
