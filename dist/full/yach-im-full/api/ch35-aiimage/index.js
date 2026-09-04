/**
 * AI 图像生成
 * 路由来源：aiimage.js (前缀 612meeting)
 */
const { postJson } = require('../../utils/request');

/**
 * AI 图像综合教育
 * 路由：612meeting/aiimage/comeducation
 */
async function aiimageComeducation(opts = {}) {
  const r = await postJson('612meeting/aiimage/comeducation', opts);
  if (r.code !== 200) throw new Error(`aiimageComeducation failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  aiimageComeducation,
};
