/**
 * 通知列表 + 回收站/文件过期
 * 路由来源：696api.js (前缀 696file)
 */
const { get, post } = require('../../utils/request');

/**
 * 获取通知列表
 * 路由：696file/notice/list
 */
async function getNoticeList(opts = {}) {
  const r = await post('696file/notice/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getNoticeList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 删除回收站文件（写操作）
 * 路由：696file/recyclebin/del
 */
async function deleteRecycleBinFile(fileIds) {
  if (!Array.isArray(fileIds)) throw new Error('[ch23-notification:deleteRecycleBinFile] fileIds 必填');
  const r = await post('696file/recyclebin/del', {
    file_ids: JSON.stringify(fileIds.map(String)),
  });
  if (r.code !== 200) throw new Error(`deleteRecycleBinFile failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 检查文件过期
 * 路由：696file/check/file/expire
 */
async function checkFileExpire(fileIds, receiveId) {
  if (!Array.isArray(fileIds)) throw new Error('[ch23-notification:checkFileExpire] fileIds 必填');
  if (!receiveId) throw new Error('[ch23-notification:checkFileExpire] receiveId 必填');
  const r = await post('696file/check/file/expire', {
    receive_id: String(receiveId),
    file_ids: fileIds.map(String),
  });
  if (r.code !== 200) throw new Error(`checkFileExpire failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

module.exports = {
  getNoticeList,
  deleteRecycleBinFile,
  checkFileExpire,
};
