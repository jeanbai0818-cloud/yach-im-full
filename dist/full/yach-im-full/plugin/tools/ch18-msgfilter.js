/**
 * 知音楼 Agent 工具集 — 消息过滤
 *
 * 调用 API: ../../api/ch27-msgfilter/index.js
 *
 * 工具列表：
 *   yachGetSensitiveWordsConfig — 敏感词配置
 *   yachQuerySensitiveMsgs      — 敏感消息查询
 *   yachDeleteUserDbUpload      — 删除上传（写）
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetSensitiveWordsConfig = {
    name: "yach_get_sensitive_words_config",
    label: "敏感词配置",
    description: "获取敏感词过滤配置。只读。",
    parameters: Type.Object({}),
    async execute(_id, _params) {
        const require = createRequire(import.meta.url);
        const ch27 = require("../../api/ch27-msgfilter/index.js");
        const result = await ch27.getSensitiveWordsConfig();
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachQuerySensitiveMsgs = {
    name: "yach_query_sensitive_msgs",
    label: "敏感消息查询",
    description: "查询被过滤的敏感消息记录。支持时间范围、关键词筛选。只读。",
    parameters: Type.Object({
        keyword: Type.Optional(Type.String({ description: "关键词筛选（可选）" })),
        startDate: Type.Optional(Type.String({ description: "开始日期 YYYY-MM-DD（可选）" })),
        endDate: Type.Optional(Type.String({ description: "结束日期 YYYY-MM-DD（可选）" })),
        page: Type.Optional(Type.Integer({ description: "页码，默认 1" })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量，默认 20" })),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch27 = require("../../api/ch27-msgfilter/index.js");
        const result = await ch27.getSensitiveWordsMsgs({
            keyword: params.keyword,
            startDate: params.startDate,
            endDate: params.endDate,
            page: params.page ?? 1,
            pagesize: params.pagesize ?? 20,
        });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachDeleteUserDbUpload = {
    name: "yach_delete_user_db_upload",
    label: "删除上传记录（写）",
    description: "删除用户的数据库上传记录。写操作，执行前需用户确认。",
    parameters: Type.Object({
        deviceId: Type.String({ description: "删除通知中的设备 id" }),
        delTimetag: Type.Integer({ minimum: 1, description: "删除事件的原始秒级时间戳" }),
    }),
    async execute(_id, params) {
        const require = createRequire(import.meta.url);
        const ch27 = require("../../api/ch27-msgfilter/index.js");
        const result = await ch27.deleteUserDbUpload({
            deviceId: params.deviceId,
            delTimetag: params.delTimetag,
        });
        return toolResult(`✅ 已提交删除通知 deviceId=${params.deviceId}\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch18-msgfilter.js.map