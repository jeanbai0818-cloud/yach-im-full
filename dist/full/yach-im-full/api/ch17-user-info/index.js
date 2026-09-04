/**
 * 用户资料设置
 * 路由来源：usergroup.js + capi.js
 * 子模块 userinfo/*, ucenter/user/*
 */
const { get, post } = require('../../utils/request');

/**
 * 获取聚合用户信息
 * 路由：usergroup/userinfo/aggre
 */
async function getUserInfoAggre(userId) {
  const r = await post('usergroup/userinfo/aggre', { user_id: userId ? String(userId) : '' });
  if (r.code !== 200) throw new Error(`getUserInfoAggre failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 设置用户信息（写操作）
 * 路由：usergroup/user/setInfo
 */
async function setUserInfo(fields) {
  if (!fields || typeof fields !== 'object') throw new Error('[ch17-user-info:setUserInfo] fields 必填');
  const r = await post('usergroup/user/setInfo', { ...fields });
  if (r.code !== 200) throw new Error(`setUserInfo failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取用户空间地址
 * 路由：usergroup/ug/user/space_addr
 */
async function getUserSpace(userId) {
  if (!userId) throw new Error('[ch17-user-info:getUserSpace] userId 必填');
  const r = await post('usergroup/ug/user/space_addr', { user_id: String(userId) });
  if (r.code !== 200) throw new Error(`getUserSpace failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  getUserInfoAggre,
  setUserInfo,
  getUserSpace,
};
