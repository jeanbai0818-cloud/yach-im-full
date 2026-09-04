/**
 * 会话置顶管理
 * 路由来源：capi.js (前缀 94capi)
 * 子模块 session/top/*
 */
const { get, post } = require('../../utils/request');

/**
 * 置顶会话（写操作）
 * 路由：94capi/session/top/add
 */
async function addSessionTop(sessionId, topUid) {
  if (!sessionId) throw new Error('[ch13-session-top:addSessionTop] sessionId 必填');
  const r = await post('94capi/session/top/add', {
    session_id: String(sessionId),
    top_uid: topUid ? String(topUid) : '',
  });
  if (r.code !== 200) throw new Error(`addSessionTop failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 取消置顶（写操作）
 * 路由：94capi/session/top/cancel
 */
async function removeSessionTop(sessionId) {
  if (!sessionId) throw new Error('[ch13-session-top:removeSessionTop] sessionId 必填');
  const r = await post('94capi/session/top/cancel', { session_id: String(sessionId) });
  if (r.code !== 200) throw new Error(`removeSessionTop failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 置顶会话排序（写操作）
 * 路由：94capi/session/top/sort
 */
async function sortSessionTop(orders) {
  if (!Array.isArray(orders)) throw new Error('[ch13-session-top:sortSessionTop] orders 必填');
  const r = await post('94capi/session/top/sort', {
    orders: JSON.stringify(orders),
  });
  if (r.code !== 200) throw new Error(`sortSessionTop failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取置顶配置
 * 路由：94capi/session/top/conf/info
 */
async function getSessionTopConfig() {
  const r = await post('94capi/session/top/conf/info', {});
  if (r.code !== 200) throw new Error(`getSessionTopConfig failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 设置置顶配置（写操作）
 * 路由：94capi/session/top/conf/set
 */
async function setSessionTopConfig(config) {
  if (!config) throw new Error('[ch13-session-top:setSessionTopConfig] config 必填');
  const r = await post('94capi/session/top/conf/set', {
    config: typeof config === 'string' ? config : JSON.stringify(config),
  });
  if (r.code !== 200) throw new Error(`setSessionTopConfig failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  addSessionTop,
  removeSessionTop,
  sortSessionTop,
  getSessionTopConfig,
  setSessionTopConfig,
};
