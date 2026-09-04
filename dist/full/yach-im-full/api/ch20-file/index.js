/**
 * 文件管理
 * 路由来源：file.js (前缀 96file)
 */
const { get, post } = require('../../utils/request');

/**
 * 获取文件信息
 * 路由：96file/file/info/get
 */
async function getFileInfo(fileId) {
  if (!fileId) throw new Error('[ch20-file:getFileInfo] fileId 必填');
  const r = await post('96file/file/info/ids', { file_ids: JSON.stringify([String(fileId)]) });
  if (r.code !== 200) throw new Error(`getFileInfo failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 创建文件夹（写操作）
 * 路由：96file/file/info/createEmptyDir
 */
async function createFolder(opts = {}) {
  if (!opts.parent_id) throw new Error('[ch20-file:createFolder] parent_id 必填');
  if (!opts.name) throw new Error('[ch20-file:createFolder] name 必填');
  const r = await post('96file/file/info/createEmptyDir', {
    parent_id: String(opts.parent_id),
    name: String(opts.name),
    space_id: opts.space_id ? String(opts.space_id) : '',
  });
  if (r.code !== 200) throw new Error(`createFolder failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 文件上传（写操作）
 * 路由：96file/file/info/upload
 */
async function uploadFile(opts = {}) {
  if (!opts.name) throw new Error('[ch20-file:uploadFile] name 必填');
  if (!opts.file_url) throw new Error('[ch20-file:uploadFile] file_url 必填');
  const r = await post('96file/file/info/upload', {
    name: String(opts.name),
    file_url: String(opts.file_url),
    file_size: opts.size || 0,
    file_mime: opts.mime || '',
    parent_id: opts.parent_id ? String(opts.parent_id) : '',
    space_id: opts.space_id ? String(opts.space_id) : '',
  });
  if (r.code !== 200) throw new Error(`uploadFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 重命名文件（写操作）
 * 路由：96file/file/info/rename
 */
async function renameFile(fileId, newName) {
  if (!fileId) throw new Error('[ch20-file:renameFile] fileId 必填');
  if (!newName) throw new Error('[ch20-file:renameFile] newName 必填');
  const r = await post('96file/file/info/rename', {
    file_id: String(fileId),
    name: String(newName),
  });
  if (r.code !== 200) throw new Error(`renameFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除文件/文件夹（写操作）
 * 路由：96file/file/info/delete
 */
async function deleteFile(fileIds) {
  if (!Array.isArray(fileIds)) throw new Error('[ch20-file:deleteFile] fileIds 必填');
  const r = await post('96file/file/info/delete', {
    file_ids: JSON.stringify(fileIds.map(String)),
  });
  if (r.code !== 200) throw new Error(`deleteFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 添加文件分享（写操作）
 * 路由：96file/v2/file/share/add
 */
async function addFileShare(fileIds, expireDays) {
  if (!Array.isArray(fileIds)) throw new Error('[ch20-file:addFileShare] fileIds 必填');
  const r = await post('96file/v2/file/share/add', {
    file_ids: JSON.stringify(fileIds.map(String)),
    expire_days: expireDays || 7,
  });
  if (r.code !== 200) throw new Error(`addFileShare failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 在线预览文件
 * 路由：96file/file/view
 */
async function previewFile(relationId) {
  if (!relationId) throw new Error('[ch20-file:previewFile] relationId 必填');
  const r = await post('96file/file/view', { relation_id: String(relationId) });
  if (r.code !== 200) throw new Error(`previewFile failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * WPS 预览
 * 路由：96file/file/wps/view
 */
async function wpsViewFile(fileId) {
  if (!fileId) throw new Error('[ch20-file:wpsViewFile] fileId 必填');
  const r = await post('96file/file/wps/view', { file_id: String(fileId) });
  if (r.code !== 200) throw new Error(`wpsViewFile failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 批量移动文件（写操作）
 * 路由：96file/file/operate/moveBatch
 */
async function batchMoveFile(fileIds, targetParentId) {
  if (!Array.isArray(fileIds)) throw new Error('[ch20-file:batchMoveFile] fileIds 必填');
  if (!targetParentId) throw new Error('[ch20-file:batchMoveFile] targetParentId 必填');
  const r = await post('96file/file/operate/moveBatch', {
    file_ids: JSON.stringify(fileIds.map(String)),
    target_parent_id: String(targetParentId),
  });
  if (r.code !== 200) throw new Error(`batchMoveFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 批量获取文件信息
 * 路由：96file/file/info/ids
 */
async function batchGetFileInfo(fileIds) {
  if (!Array.isArray(fileIds)) throw new Error('[ch20-file:batchGetFileInfo] fileIds 必填');
  const r = await post('96file/file/info/ids', {
    file_ids: JSON.stringify(fileIds.map(String)),
  });
  if (r.code !== 200) throw new Error(`batchGetFileInfo failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 回收站列表
 * 路由：96file/recyclebin/list
 */
async function getRecycleBinList(opts = {}) {
  const r = await post('96file/recyclebin/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getRecycleBinList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 保存到回收站（写操作）
 * 路由：96file/file/recyclebin/save
 */
async function saveToRecycleBin(fileIds) {
  if (!Array.isArray(fileIds)) throw new Error('[ch20-file:saveToRecycleBin] fileIds 必填');
  const r = await post('96file/file/recyclebin/save', {
    file_ids: JSON.stringify(fileIds.map(String)),
  });
  if (r.code !== 200) throw new Error(`saveToRecycleBin failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getFileInfo, createFolder, uploadFile, renameFile, deleteFile,
  addFileShare, previewFile, wpsViewFile, batchMoveFile,
  batchGetFileInfo, getRecycleBinList, saveToRecycleBin,
};
