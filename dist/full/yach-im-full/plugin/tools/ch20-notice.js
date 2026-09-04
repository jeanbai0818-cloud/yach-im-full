/**
 * 通知 + 回收站 + 文件过期工具
 * 对应 API: src/api/ch23-notification/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetNoticeList = {
    name: "yach_get_notice_list",
    label: "查通知列表",
    description: "查询系统通知列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch23-notification/index.js");
        const result = await ch.getNoticeList({ page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachDeleteRecycleBinFile = {
    name: "yach_delete_recycle_bin_file",
    label: "删回收站文件",
    description: "永久删除回收站中的文件。写操作，需确认。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
        receiveId: Type.String({ description: "接收方顶层 user.id 或 team.id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch23-notification/index.js");
        const result = await ch.deleteRecycleBinFile(params.fileIds);
        return toolResult(`✅ 已永久删除 ${params.fileIds.length} 个文件\n${JSON.stringify(result)}`);
    },
};
export const yachCheckFileExpire = {
    name: "yach_check_file_expire",
    label: "查文件过期状态",
    description: "批量检查文件是否过期。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch23-notification/index.js");
        const result = await ch.checkFileExpire(params.fileIds, params.receiveId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
//# sourceMappingURL=ch20-notice.js.map