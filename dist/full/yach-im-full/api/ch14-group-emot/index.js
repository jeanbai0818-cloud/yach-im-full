/**
 * 群表情管理
 * 路由来源：capi.js (前缀 94capi)
 * 子模块 group/emot/*
 */
const { get, post } = require('../../utils/request');

/**
 * 获取群表情列表
 * 路由：94capi/group/emot/get
 */
async function getGroupEmotList(tid) {
  if (!tid) throw new Error('[ch14-group-emot:getGroupEmotList] tid 必填');
  const r = await post('94capi/group/emot/get', { team_id: String(tid) });
  if (r.code !== 200) throw new Error(`getGroupEmotList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 获取单个群表情
 * 路由：94capi/group/emot/get/one
 */
async function getGroupEmotOne(emotId) {
  if (!emotId) throw new Error('[ch14-group-emot:getGroupEmotOne] emotId 必填');
  const r = await post('94capi/group/emot/get/one', { emot_id: String(emotId) });
  if (r.code !== 200) throw new Error(`getGroupEmotOne failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 添加群表情（写操作）
 * 路由：94capi/group/emot/add
 */
async function addGroupEmot(opts = {}) {
  if (!opts.session_id) throw new Error('[ch14-group-emot:addGroupEmot] session_id 必填');
  if (!opts.msg_id) throw new Error('[ch14-group-emot:addGroupEmot] msg_id 必填');
  if (!opts.emot) throw new Error('[ch14-group-emot:addGroupEmot] emot 必填');
  const r = await post('94capi/group/emot/add', {
    session_id: String(opts.session_id),
    msg_id: String(opts.msg_id),
    emot: String(opts.emot),
    curr_time: Number(opts.curr_time || Math.floor(Date.now() / 1000)),
  });
  if (r.code !== 200) throw new Error(`addGroupEmot failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getGroupEmotList,
  getGroupEmotOne,
  addGroupEmot,
};
