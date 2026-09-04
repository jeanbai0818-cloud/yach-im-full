/**
 * 开放平台 API
 * 路由来源：oapi.js (前缀 93oapi)
 */
const { get, post } = require('../../utils/request');

/**
 * 开放平台单发消息
 * 路由：93oapi/openapi/message/single/send
 */
async function oapiMessageSingleSend(opts = {}) {
  if (!opts.toUserId) throw new Error('[ch29-oapi:oapiMessageSingleSend] toUserId 必填');
  if (!opts.content) throw new Error('[ch29-oapi:oapiMessageSingleSend] content 必填');
  const payload = {
    to_user_id: String(opts.toUserId),
    message: JSON.stringify({ msgtype: 'text', text: { content: String(opts.content) } }),
  };
  if (opts.agentId) payload.agent_id = String(opts.agentId);
  const r = await post('93oapi/openapi/message/single/send', payload);
  if (r.code !== 200) throw new Error(`oapiMessageSingleSend failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取机器人列表
 * 路由：93oapi/robot/list
 */
async function getOapiRobotsList() {
  const r = await post('93oapi/robot/list', {});
  if (r.code !== 200) throw new Error(`getOapiRobotsList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 获取开放平台应用详情
 * 路由：93oapi/app/detail
 */
async function getOapiDetail(appId) {
  if (!appId) throw new Error('[ch29-oapi:getOapiDetail] appId 必填');
  const r = await post('93oapi/app/detail', { app_id: String(appId) });
  if (r.code !== 200) throw new Error(`getOapiDetail failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取应用推送状态
 * 路由：93oapi/app/push/state
 */
async function getAppPushState(appId) {
  if (!appId) throw new Error('[ch29-oapi:getAppPushState] appId 必填');
  const r = await post('93oapi/app/push/state', { app_id: String(appId) });
  if (r.code !== 200) throw new Error(`getAppPushState failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 设置应用推送（写操作）
 * 路由：93oapi/app/push/set
 */
async function setAppPush(opts = {}) {
  if (!opts.app_id) throw new Error('[ch29-oapi:setAppPush] app_id 必填');
  const r = await post('93oapi/app/push/set', {
    app_id: String(opts.app_id),
    push_enabled: opts.enabled !== undefined ? (opts.enabled ? 1 : 0) : 1,
  });
  if (r.code !== 200) throw new Error(`setAppPush failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 停止流
 * 路由：93oapi/msg/stream/stop
 */
async function stopStream(streamId) {
  if (!streamId) throw new Error('[ch29-oapi:stopStream] streamId 必填');
  const r = await post('93oapi/msg/stream/stop', { stream_id: String(streamId) });
  if (r.code !== 200) throw new Error(`stopStream failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取下一级组织
 * 路由：93oapi/openapi/app/next/organ
 */
async function getNextOrgan(appId, deptId) {
  if (!appId) throw new Error('[ch29-oapi:getNextOrgan] appId 必填');
  const r = await post('93oapi/openapi/app/next/organ', {
    app_id: String(appId),
    dept_id: deptId ? String(deptId) : '',
  });
  if (r.code !== 200) throw new Error(`getNextOrgan failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

module.exports = {
  oapiMessageSingleSend,
  getOapiRobotsList,
  getOapiDetail,
  getAppPushState,
  setAppPush,
  stopStream,
  getNextOrgan,
};
