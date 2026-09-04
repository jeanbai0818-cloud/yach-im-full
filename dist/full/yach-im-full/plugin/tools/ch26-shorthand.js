/**
 * 速记/录音管理工具
 * 对应 API: src/api/ch21-shorthand/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetShorthandList = {
    name: "yach_get_shorthand_list",
    label: "查速记列表",
    description: "查询速记（录音）列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch21-shorthand/index.js");
        const result = await ch.getShorthandList({ page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetShorthandDetail = {
    name: "yach_get_shorthand_detail",
    label: "查速记详情",
    description: "查询速记详情。",
    parameters: Type.Object({
        shorthandId: Type.String({ description: "速记 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch21-shorthand/index.js");
        const result = await ch.getShorthandDetail(params.shorthandId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachUploadShorthand = {
    name: "yach_upload_shorthand",
    label: "上传速记",
    description: "完成速记上传。写操作，需确认。",
    parameters: Type.Object({
        id: Type.String({ description: "速记 id" }),
        url: Type.String({ description: "音频文件 URL" }),
        title: Type.Optional(Type.String({ description: "标题" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch21-shorthand/index.js");
        const result = await ch.uploadFinishShorthand({ id: params.id, url: params.url, title: params.title });
        return toolResult(`✅ 已上传速记\n${JSON.stringify(result)}`);
    },
};
export const yachUpdateShorthand = {
    name: "yach_update_shorthand",
    label: "更新速记",
    description: "更新速记信息（标题/内容）。写操作，需确认。",
    parameters: Type.Object({
        id: Type.String({ description: "速记 id" }),
        title: Type.Optional(Type.String({ description: "新标题" })),
        content: Type.Optional(Type.String({ description: "新内容" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch21-shorthand/index.js");
        const result = await ch.updateShorthand({ id: params.id, title: params.title, content: params.content });
        return toolResult(`✅ 已更新速记\n${JSON.stringify(result)}`);
    },
};
export const yachDeleteShorthand = {
    name: "yach_delete_shorthand",
    label: "删除速记",
    description: "删除速记。写操作，需确认。",
    parameters: Type.Object({
        shorthandId: Type.String({ description: "速记 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch21-shorthand/index.js");
        const result = await ch.deleteShorthand(params.shorthandId);
        return toolResult(`✅ 已删除速记\n${JSON.stringify(result)}`);
    },
};
export const yachGetShareToMeShorthandList = {
    name: "yach_get_share_to_me_shorthand_list",
    label: "查分享给我的速记",
    description: "查询分享给我的速记列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch21-shorthand/index.js");
        const result = await ch.getShareToMeShorthandList({ page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
//# sourceMappingURL=ch26-shorthand.js.map