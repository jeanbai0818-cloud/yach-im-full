/**
 * 文件管理工具
 * 对应 API: src/api/ch20-file/index.js
 */
import { Type } from "typebox";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function toolResult(text) {
    return { content: [{ type: "text", text }], details: null };
}
export const yachGetFileInfo = {
    name: "yach_get_file_info",
    label: "查文件信息",
    description: "查询文件信息。",
    parameters: Type.Object({
        fileId: Type.String({ description: "文件 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.getFileInfo(params.fileId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachCreateFolder = {
    name: "yach_create_folder",
    label: "创建文件夹",
    description: "创建文件夹。写操作，需确认。",
    parameters: Type.Object({
        parentId: Type.String({ description: "父目录 id" }),
        name: Type.String({ description: "文件夹名称" }),
        spaceId: Type.Optional(Type.String({ description: "空间 id（可选）" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.createFolder({ parent_id: params.parentId, name: params.name, space_id: params.spaceId });
        return toolResult(`✅ 已创建文件夹「${params.name}」\n${JSON.stringify(result)}`);
    },
};
export const yachUploadFile = {
    name: "yach_upload_file",
    label: "上传文件",
    description: "上传文件到文件云盘。写操作，需确认。",
    parameters: Type.Object({
        name: Type.String({ description: "文件名" }),
        fileUrl: Type.String({ description: "文件 URL（已上传到 NOS/COS 后的地址）" }),
        size: Type.Optional(Type.Integer({ description: "文件大小" })),
        mime: Type.Optional(Type.String({ description: "MIME 类型" })),
        parentId: Type.Optional(Type.String({ description: "目标目录 id" })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.uploadFile({ name: params.name, file_url: params.fileUrl, size: params.size, mime: params.mime, parent_id: params.parentId });
        return toolResult(`✅ 已上传文件「${params.name}」\n${JSON.stringify(result)}`);
    },
};
export const yachRenameFile = {
    name: "yach_rename_file",
    label: "重命名文件",
    description: "重命名文件或文件夹。写操作，需确认。",
    parameters: Type.Object({
        fileId: Type.String({ description: "文件 id" }),
        newName: Type.String({ description: "新名称" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.renameFile(params.fileId, params.newName);
        return toolResult(`✅ 已重命名\n${JSON.stringify(result)}`);
    },
};
export const yachDeleteFile = {
    name: "yach_delete_file",
    label: "删除文件",
    description: "删除文件或文件夹。写操作，需确认。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.deleteFile(params.fileIds);
        return toolResult(`✅ 已删除 ${params.fileIds.length} 个文件\n${JSON.stringify(result)}`);
    },
};
export const yachShareFile = {
    name: "yach_share_file",
    label: "分享文件",
    description: "添加文件分享。写操作，需确认。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
        expireDays: Type.Optional(Type.Integer({ description: "过期天数，默认 7", default: 7 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.addFileShare(params.fileIds, params.expireDays ?? 7);
        return toolResult(`✅ 已分享 ${params.fileIds.length} 个文件\n${JSON.stringify(result)}`);
    },
};
export const yachPreviewFile = {
    name: "yach_preview_file",
    label: "在线预览文件",
    description: "获取文件在线预览地址。",
    parameters: Type.Object({
        relationId: Type.String({ description: "文件关系 id（relation_id，不是普通 file_id）" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.previewFile(params.relationId);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachBatchMoveFile = {
    name: "yach_batch_move_file",
    label: "批量移动文件",
    description: "批量移动文件/文件夹到新目录。写操作，需确认。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
        targetParentId: Type.String({ description: "目标目录 id" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.batchMoveFile(params.fileIds, params.targetParentId);
        return toolResult(`✅ 已移动 ${params.fileIds.length} 个文件\n${JSON.stringify(result)}`);
    },
};
export const yachBatchGetFileInfo = {
    name: "yach_batch_get_file_info",
    label: "批量查文件信息",
    description: "批量获取文件信息。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.batchGetFileInfo(params.fileIds);
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachGetRecycleBinList = {
    name: "yach_get_recycle_bin_list",
    label: "查回收站列表",
    description: "查询文件回收站列表。",
    parameters: Type.Object({
        page: Type.Optional(Type.Integer({ description: "页码", default: 1 })),
        pagesize: Type.Optional(Type.Integer({ description: "每页数量", default: 20 })),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.getRecycleBinList({ page: params.page ?? 1, pagesize: params.pagesize ?? 20 });
        return toolResult(JSON.stringify(result, null, 2));
    },
};
export const yachSaveToRecycleBin = {
    name: "yach_save_to_recycle_bin",
    label: "保存到回收站",
    description: "将文件/文件夹移入回收站。写操作，需确认。",
    parameters: Type.Object({
        fileIds: Type.Array(Type.String(), { description: "文件 id 数组" }),
    }),
    async execute(_id, params) {
        const ch = require("../../api/ch20-file/index.js");
        const result = await ch.saveToRecycleBin(params.fileIds);
        return toolResult(`✅ 已移入回收站 ${params.fileIds.length} 个文件\n${JSON.stringify(result)}`);
    },
};
//# sourceMappingURL=ch18-file-mgmt.js.map