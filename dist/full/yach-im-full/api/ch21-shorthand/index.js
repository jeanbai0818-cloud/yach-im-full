/**
 * 速记/录音管理
 * 路由来源：audio.js (前缀 612meeting)
 * 子模块 off-record/*
 */
const { get, post } = require('../../utils/request');

/**
 * 获取我的速记列表
 * 路由：612meeting/client/meeting/list
 */
async function getMyShorthandList(opts = {}) {
  const r = await get('612meeting/off-record/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getMyShorthandList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取速记列表
 * 路由：612meeting/off-record/list
 */
async function getShorthandList(opts = {}) {
  const r = await get('612meeting/off-record/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getShorthandList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取速记详情
 * 路由：612meeting/off-record/detail
 */
async function getShorthandDetail(shorthandId) {
  if (!shorthandId) throw new Error('[ch21-shorthand:getShorthandDetail] shorthandId 必填');
  const r = await get('612meeting/off-record/detail', { task_id: String(shorthandId) });
  if (r.code !== 200) throw new Error(`getShorthandDetail failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取准备上传 Token
 * 路由：612meeting/off-record/upload/prepare
 */
async function prepareUploadShorthand() {
  const r = await post('612meeting/off-record/upload/prepare', {});
  if (r.code !== 200) throw new Error(`prepareUploadShorthand failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 完成速记上传（写操作）
 * 路由：612meeting/off-record/upload/finish
 */
async function uploadFinishShorthand(opts = {}) {
  if (!opts.id) throw new Error('[ch21-shorthand:uploadFinishShorthand] id 必填');
  const r = await post('612meeting/off-record/upload/finish', {
    id: String(opts.id),
    url: opts.url || '',
    title: opts.title || '',
  });
  if (r.code !== 200) throw new Error(`uploadFinishShorthand failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 更新速记（写操作）
 * 路由：612meeting/off-record/update
 */
async function updateShorthand(opts = {}) {
  if (!opts.id) throw new Error('[ch21-shorthand:updateShorthand] id 必填');
  const r = await post('612meeting/off-record/update', {
    id: String(opts.id),
    title: opts.title || '',
    content: opts.content || '',
  });
  if (r.code !== 200) throw new Error(`updateShorthand failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除速记（写操作）
 * 路由：612meeting/off-record/delete
 */
async function deleteShorthand(shorthandId) {
  if (!shorthandId) throw new Error('[ch21-shorthand:deleteShorthand] shorthandId 必填');
  const r = await post('612meeting/off-record/delete', { id: String(shorthandId) });
  if (r.code !== 200) throw new Error(`deleteShorthand failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取分享给我速记列表
 * 路由：612meeting/client/upload/record/share/list
 */
async function getShareToMeShorthandList(opts = {}) {
  const r = await get('612meeting/client/upload/record/share/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getShareToMeShorthandList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 删除分享给我速记（写操作）
 * 路由：612meeting/client/upload/record/share/del
 */
async function deleteShareToMeShorthand(shorthandId) {
  if (!shorthandId) throw new Error('[ch21-shorthand:deleteShareToMeShorthand] shorthandId 必填');
  const r = await post('612meeting/client/upload/record/share/del', { id: String(shorthandId) });
  if (r.code !== 200) throw new Error(`deleteShareToMeShorthand failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getMyShorthandList, getShorthandList, getShorthandDetail,
  prepareUploadShorthand, uploadFinishShorthand,
  updateShorthand, deleteShorthand,
  getShareToMeShorthandList, deleteShareToMeShorthand,
};
