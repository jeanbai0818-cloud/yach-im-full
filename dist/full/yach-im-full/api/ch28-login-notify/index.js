/**
 * 多端登录通知
 * 路由来源：multi.js (前缀 925multi)
 */
const { post } = require('../../utils/request');

/**
 * 登录通知
 * 路由：925multi/login/notify44
 */
async function loginNotify44(opts = {}) {
  const r = await post('925multi/login/notify44', opts);
  if (r.code !== 200) throw new Error(`loginNotify44 failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  loginNotify44,
};
