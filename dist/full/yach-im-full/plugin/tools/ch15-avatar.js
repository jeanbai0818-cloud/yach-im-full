/**
 * 头像管理工具
 * 对应 API: src/api/ch15-avatar/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
function writeToolResult(text) {
    return toolResult(`${text}\n操作已经执行，必须向用户明确回复本次结果；不得返回 NO_REPLY，也不得再次上传。`);
}
export const yachGetAvatarInfo = {
    name: "yach_get_avatar_info",
    label: "查头像信息",
    description: "查询用户头像信息。",
    parameters: Type.Object({
        userId: Type.String({ description: "用户 user_id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch15-avatar/index.js");
        const result = await ch.getAvatarInfo(params.userId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachUploadAvatar = {
    name: "yach_upload_avatar",
    label: "上传头像",
    description: "把允许目录内的本地图片设置为当前登录用户的知音楼头像。" +
        "真实执行 STS→COS→个人信息保存→回读核验。写操作，执行前必须确认；token 失效时报错并要求用户执行 /yach_login。",
    parameters: Type.Object({
        filePath: Type.String({ description: "本地图片绝对路径；必须位于 allowedFileRoots，支持 PNG/JPG/JPEG/GIF/WEBP" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch15-avatar/index.js");
        const result = await ch.setAvatarImage(params.filePath);
        return writeToolResult(`✅ 头像更新成功并已回读核验。\nCDN URL: ${result.cdnUrl}`);
    },
};
//# sourceMappingURL=ch15-avatar.js.map
