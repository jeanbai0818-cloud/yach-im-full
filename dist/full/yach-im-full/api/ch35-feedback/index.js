/**
 * 反馈系统
 * 路由：94capi/ucenter/feedback/save
 */
const { post } = require('../../utils/request');

async function createFeedback(opts = {}) {
  if (!opts.content) throw new Error('[ch35-feedback:createFeedback] content 必填');
  const r = await post('94capi/ucenter/feedback/save', {
    content: String(opts.content),
    category: opts.category || '',
    screenshot: opts.screenshot || '',
    contact: opts.contact || '',
  });
  if (r.code !== 200) throw new Error(`createFeedback failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = { createFeedback };
