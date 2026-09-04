/**
 * 侧栏配置
 * 路由来源：usergroup.js (前缀 usergroup)
 * 子模块 user_conf/*
 */
const { get, post } = require('../../utils/request');

/**
 * 获取侧栏配置
 * 路由：usergroup/user_conf/get_pc_user_conf
 */
async function getSideBarConf() {
  const r = await post('usergroup/user_conf/get_pc_user_conf', {});
  if (r.code !== 200) throw new Error(`getSideBarConf failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 保存侧栏配置（写操作）
 * 路由：usergroup/user_conf/pc_user_conf_renew
 */
async function saveSideBarConf(config) {
  if (!config) throw new Error('[ch16-sidebar:saveSideBarConf] config 必填');
  const r = await post('usergroup/user_conf/pc_user_conf_renew', {
    config: typeof config === 'string' ? config : JSON.stringify(config),
  });
  if (r.code !== 200) throw new Error(`saveSideBarConf failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 添加侧栏导航（写操作）
 * 路由：usergroup/user_conf/add_nav_app
 */
async function addSideBarNav(appId) {
  if (!appId) throw new Error('[ch16-sidebar:addSideBarNav] appId 必填');
  const r = await post('usergroup/user_conf/add_nav_app', {
    client_type: 0,
    app_unique_id: String(appId),
    op_source: '1',
  });
  if (r.code !== 200) throw new Error(`addSideBarNav failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除侧栏导航（写操作）
 * 路由：usergroup/user_conf/remove_nav_app
 */
async function delSideBarNav(appId) {
  if (!appId) throw new Error('[ch16-sidebar:delSideBarNav] appId 必填');
  const r = await post('usergroup/user_conf/remove_nav_app', { app_id: String(appId) });
  if (r.code !== 200) throw new Error(`delSideBarNav failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getSideBarConf,
  saveSideBarConf,
  addSideBarNav,
  delSideBarNav,
};
