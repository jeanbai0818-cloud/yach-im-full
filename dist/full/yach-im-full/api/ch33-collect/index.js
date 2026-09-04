/**
 * 收集表
 * 路由来源：615api.js (前缀 615bsvr)
 */
const { get, post } = require('../../utils/request');

/**
 * 添加收集（写操作）
 * 路由：615bsvr/collect/add
 */
async function addCollect(opts = {}) {
  const r = await post('615bsvr/collect/add', {
    title: opts.title || '',
    content: opts.content || '',
  });
  if (r.code !== 200) throw new Error(`addCollect failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除收集（写操作）
 * 路由：615bsvr/collect/del
 */
async function delCollect(collectId) {
  if (!collectId) throw new Error('[ch33-collect:delCollect] collectId 必填');
  const r = await post('615bsvr/collect/del', { id: String(collectId) });
  if (r.code !== 200) throw new Error(`delCollect failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  addCollect,
  delCollect,
};
