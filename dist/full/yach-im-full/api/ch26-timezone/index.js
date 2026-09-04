/**
 * 时区管理
 * 路由来源：694api.js (前缀 com694)
 */
const { get, post } = require('../../utils/request');

/**
 * 获取时区列表
 * 路由：com694/platform/timezone/list
 */
async function getCustomTimezoneList() {
  const r = await get('com694/platform/timezone/list', {});
  if (r.code !== 200) throw new Error(`getCustomTimezoneList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 保存时区（写操作）
 * 路由：com694/platform/user/set/timezone
 */
async function saveTimezone(opts) {
  if (typeof opts === 'string') opts = { timezone: opts };
  if (!opts || !opts.timezone) throw new Error('[ch26-timezone:saveTimezone] timezone 必填');
  const r = await post('com694/platform/user/set/timezone', {
    default_timezone: JSON.stringify({
      is_custom: opts.is_custom ?? 1,
      timezone: String(opts.timezone),
      identifier: String(opts.identifier || opts.timezone),
    }),
  });
  if (r.code !== 200) throw new Error(`saveTimezone failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取支持时区列表
 * 路由：com694/platform/support/timezone
 */
async function getSupportTimezoneList() {
  const r = await get('com694/platform/support/timezone', {});
  if (r.code !== 200) throw new Error(`getSupportTimezoneList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 删除时区（写操作）
 * 路由：com694/platform/user/del/timezone
 */
async function deleteTimezone(timezoneId) {
  const id = typeof timezoneId === 'object' ? timezoneId?.timezone_id : timezoneId;
  if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
    throw new Error('[ch26-timezone:deleteTimezone] timezoneId 必须是正整数');
  }
  const r = await post('com694/platform/user/del/timezone', {
    timezone_id: Number(id),
  });
  if (r.code !== 200) throw new Error(`deleteTimezone failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getCustomTimezoneList,
  saveTimezone,
  getSupportTimezoneList,
  deleteTimezone,
};
