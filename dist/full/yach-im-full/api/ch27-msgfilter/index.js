/**
 * 消息过滤/敏感词
 * 路由来源：msgfilter.js (前缀 mfilter)
 */
const { get, post } = require('../../utils/request');

/**
 * 获取敏感词配置
 * 路由：mfilter/msgfilter/query/sensitive/config
 */
async function getSensitiveWordsConfig() {
  const r = await post('mfilter/msgfilter/query/sensitive/config', {});
  if (r.code !== 200) throw new Error(`getSensitiveWordsConfig failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 查询敏感消息
 * 路由：mfilter/msgfilter/query/sensitive/msgs
 */
async function getSensitiveWordsMsgs(opts = {}) {
  const r = await post('mfilter/msgfilter/query/sensitive/msgs', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getSensitiveWordsMsgs failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 删除用户上传（写操作）
 * 路由：mfilter/msgfilter/del/notify
 */
async function deleteUserDbUpload(opts = {}) {
  if (!opts.deviceId) throw new Error('[ch27-msgfilter:deleteUserDbUpload] deviceId 必填');
  if (!Number.isInteger(Number(opts.delTimetag)) || Number(opts.delTimetag) <= 0) {
    throw new Error('[ch27-msgfilter:deleteUserDbUpload] delTimetag 必须是正整数时间戳');
  }
  const r = await post('mfilter/msgfilter/del/notify', {
    deviceId: String(opts.deviceId),
    delTimetag: Number(opts.delTimetag),
    delStatus: 'SUCCESS',
  });
  if (r.code !== 200) throw new Error(`deleteUserDbUpload failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getSensitiveWordsConfig,
  getSensitiveWordsMsgs,
  deleteUserDbUpload,
};
