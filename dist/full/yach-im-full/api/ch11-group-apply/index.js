/**
 * 入群申请管理
 * 路由来源：usergroup.js (前缀 usergroup)
 * 子模块 ug/group/apply/*
 */
const { get, post } = require('../../utils/request');

/**
 * 入群申请列表
 * 路由：usergroup/ug/group/apply/list
 */
async function getGroupApplyList(teamId, opts = {}) {
  if (!teamId) throw new Error('[ch11-group-apply:getGroupApplyList] teamId 必填');
  const r = await post('usergroup/ug/group/apply/list', {
    team_id: String(teamId),
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getGroupApplyList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 接受入群申请（写操作）
 * 路由：usergroup/ug/group/apply/accept
 */
async function acceptGroupApply(teamId, userId, reason) {
  if (!teamId) throw new Error('[ch11-group-apply:acceptGroupApply] teamId 必填');
  if (!userId) throw new Error('[ch11-group-apply:acceptGroupApply] userId 必填');
  const r = await post('usergroup/ug/group/apply/accept', {
    team_id: String(teamId),
    user_id: String(userId),
    reason: reason || '',
  });
  if (r.code !== 200) throw new Error(`acceptGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 拒绝入群申请（写操作）
 * 路由：usergroup/ug/group/apply/reject
 */
async function rejectGroupApply(teamId, userId, reason) {
  if (!teamId) throw new Error('[ch11-group-apply:rejectGroupApply] teamId 必填');
  if (!userId) throw new Error('[ch11-group-apply:rejectGroupApply] userId 必填');
  const r = await post('usergroup/ug/group/apply/reject', {
    team_id: String(teamId),
    user_id: String(userId),
    reason: reason || '',
  });
  if (r.code !== 200) throw new Error(`rejectGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 批量处理入群申请（写操作）
 * 路由：usergroup/ug/group/apply/batch
 */
async function batchGroupApply(teamId, userActions, action) {
  if (!teamId) throw new Error('[ch11-group-apply:batchGroupApply] teamId 必填');
  if (!Array.isArray(userActions)) throw new Error('[ch11-group-apply:batchGroupApply] userActions 必填');
  if (!action) throw new Error('[ch11-group-apply:batchGroupApply] action 必填 (accept/reject/ignore)');
  const r = await post('usergroup/ug/group/apply/batch', {
    team_id: String(teamId),
    users: JSON.stringify(userActions.map(u => ({ user_id: String(u), action }))),
  });
  if (r.code !== 200) throw new Error(`batchGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 忽略入群申请（写操作）
 * 路由：usergroup/ug/group/apply/ignore
 */
async function ignoreGroupApply(teamId, userId) {
  if (!teamId) throw new Error('[ch11-group-apply:ignoreGroupApply] teamId 必填');
  if (!userId) throw new Error('[ch11-group-apply:ignoreGroupApply] userId 必填');
  const r = await post('usergroup/ug/group/apply/ignore', {
    team_id: String(teamId),
    user_id: String(userId),
  });
  if (r.code !== 200) throw new Error(`ignoreGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取入群申请数量
 * 路由：usergroup/ug/group/apply/count
 */
async function getGroupApplyCount(teamId) {
  if (!teamId) throw new Error('[ch11-group-apply:getGroupApplyCount] teamId 必填');
  const r = await post('usergroup/ug/group/apply/count', { team_id: String(teamId) });
  if (r.code !== 200) throw new Error(`getGroupApplyCount failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取入群设置
 * 路由：usergroup/ug/group/apply/config
 */
async function getGroupApplyConfig(teamId) {
  if (!teamId) throw new Error('[ch11-group-apply:getGroupApplyConfig] teamId 必填');
  const r = await post('usergroup/ug/group/apply/config', { team_id: String(teamId) });
  if (r.code !== 200) throw new Error(`getGroupApplyConfig failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  getGroupApplyList,
  acceptGroupApply,
  rejectGroupApply,
  batchGroupApply,
  ignoreGroupApply,
  getGroupApplyCount,
  getGroupApplyConfig,
};
