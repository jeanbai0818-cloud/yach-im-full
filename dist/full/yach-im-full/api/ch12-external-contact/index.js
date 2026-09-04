/**
 * 外部联系人管理
 * 路由来源：usergroup.js (前缀 usergroup)
 * 子模块 contact/*
 */
const { get, post } = require('../../utils/request');

/**
 * 添加外部联系人（写操作）
 * 路由：usergroup/contact/apply
 */
async function addExternalContact(userId, reason) {
  if (!userId) throw new Error('[ch12-external-contact:addExternalContact] userId 必填');
  const r = await post('usergroup/contact/apply', {
    user_id: String(userId),
    reason: reason || '',
  });
  if (r.code !== 200) throw new Error(`addExternalContact failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 处理外部联系人请求（写操作）
 * 路由：usergroup/contact/apply/handle
 */
async function handleExternalApply(applyId, accept) {
  if (!applyId) throw new Error('[ch12-external-contact:handleExternalApply] applyId 必填');
  const r = await post('usergroup/contact/apply/handle', {
    apply_id: String(applyId),
    accept: accept ? 1 : 0,
  });
  if (r.code !== 200) throw new Error(`handleExternalApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取外部联系人申请状态
 * 路由：usergroup/contact/apply/status
 */
async function getExternalApplyStatus(applyId) {
  if (!applyId) throw new Error('[ch12-external-contact:getExternalApplyStatus] applyId 必填');
  const r = await post('usergroup/contact/apply/status', { apply_id: String(applyId) });
  if (r.code !== 200) throw new Error(`getExternalApplyStatus failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取我发起的添加请求列表
 * 路由：usergroup/contact/apply/applied
 */
async function listMyExternalApps(opts = {}) {
  const r = await post('usergroup/contact/apply/applied', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`listMyExternalApps failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取外部联系人列表
 * 路由：usergroup/contact/list
 */
async function listExternalContacts(opts = {}) {
  const r = await post('usergroup/contact/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 50,
  });
  if (r.code !== 200) throw new Error(`listExternalContacts failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 删除外部联系人（写操作）
 * 路由：usergroup/contact/delete
 */
async function deleteExternalContact(userId) {
  if (!userId) throw new Error('[ch12-external-contact:deleteExternalContact] userId 必填');
  const r = await post('usergroup/contact/delete', { user_id: String(userId) });
  if (r.code !== 200) throw new Error(`deleteExternalContact failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  addExternalContact,
  handleExternalApply,
  getExternalApplyStatus,
  listMyExternalApps,
  listExternalContacts,
  deleteExternalContact,
};
