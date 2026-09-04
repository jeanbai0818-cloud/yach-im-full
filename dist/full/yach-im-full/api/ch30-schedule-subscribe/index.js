/**
 * 日程订阅 / ICS 日历
 * 路由来源：schedule.js (前缀 913scd)
 */
const { get, post } = require('../../utils/request');

/**
 * 获取日程关注列表
 * 路由：913scd/schedule/share/followers
 */
async function getScheduleShareFollowers(scheduleId) {
  if (!scheduleId) throw new Error('[ch30-schedule-subscribe:getScheduleShareFollowers] scheduleId 必填');
  const r = await post('913scd/schedule/share/followers', { share_id: String(scheduleId) });
  if (r.code !== 200) throw new Error(`getScheduleShareFollowers failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 获取日程订阅设置
 * 路由：913scd/schedule/subscription/settings
 */
async function getScheduleSubscriptionSettings(permission) {
  if (![0, 1, 2].includes(Number(permission))) {
    throw new Error('[ch30-schedule-subscribe:getScheduleSubscriptionSettings] permission 必须是 0、1 或 2');
  }
  const r = await post('913scd/schedule/subscription/settings', { permission: Number(permission) });
  if (r.code !== 200) throw new Error(`getScheduleSubscriptionSettings failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 更新订阅者（写操作）
 * 路由：913scd/schedule/subscription/subscribers/update
 */
async function updateScheduleSubscribers(scheduleId, userActions) {
  if (!scheduleId) throw new Error('[ch30-schedule-subscribe:updateScheduleSubscribers] scheduleId 必填');
  const r = await post('913scd/schedule/subscription/subscribers/update', {
    schedule_id: String(scheduleId),
    users: JSON.stringify(userActions || []),
  });
  if (r.code !== 200) throw new Error(`updateScheduleSubscribers failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取订阅者列表
 * 路由：913scd/schedule/subscription/subscribers
 */
async function getScheduleSubscriptionSubscribers(scheduleId) {
  if (!scheduleId) throw new Error('[ch30-schedule-subscribe:getScheduleSubscriptionSubscribers] scheduleId 必填');
  const r = await get('913scd/schedule/subscription/subscribers', { schedule_id: String(scheduleId) });
  if (r.code !== 200) throw new Error(`getScheduleSubscriptionSubscribers failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 获取 ICS 日历列表
 * 路由：913scd/schedule/share/ics/list
 */
async function getScheduleShareIcsList() {
  const r = await get('913scd/schedule/share/ics/list', {});
  if (r.code !== 200) throw new Error(`getScheduleShareIcsList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 添加 ICS 日历（写操作）
 * 路由：913scd/schedule/share/ics/add
 */
async function addScheduleShareIcs(url) {
  if (!url) throw new Error('[ch30-schedule-subscribe:addScheduleShareIcs] url 必填');
  const r = await post('913scd/schedule/share/ics/add', { url: String(url) });
  if (r.code !== 200) throw new Error(`addScheduleShareIcs failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除 ICS 日历（写操作）
 * 路由：913scd/schedule/share/ics/del
 */
async function deleteScheduleShareIcs(icsId) {
  if (!icsId) throw new Error('[ch30-schedule-subscribe:deleteScheduleShareIcs] icsId 必填');
  const r = await post('913scd/schedule/share/ics/del', { ics_id: String(icsId) });
  if (r.code !== 200) throw new Error(`deleteScheduleShareIcs failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取 ICS 日历信息
 * 路由：913scd/schedule/share/ics/info
 */
async function getScheduleShareIcsInfo(icsId) {
  if (!icsId) throw new Error('[ch30-schedule-subscribe:getScheduleShareIcsInfo] icsId 必填');
  const r = await get('913scd/schedule/share/ics/info', { ics_id: String(icsId) });
  if (r.code !== 200) throw new Error(`getScheduleShareIcsInfo failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * ICS 同步（写操作）
 * 路由：913scd/schedule/share/ics/sync
 */
async function syncScheduleShareIcs(icsId) {
  if (!icsId) throw new Error('[ch30-schedule-subscribe:syncScheduleShareIcs] icsId 必填');
  const r = await post('913scd/schedule/share/ics/sync', { ics_id: String(icsId) });
  if (r.code !== 200) throw new Error(`syncScheduleShareIcs failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * ICS 编辑（写操作）
 * 路由：913scd/schedule/share/ics/edit
 */
async function editScheduleShareIcs(opts = {}) {
  if (!opts.ics_id) throw new Error('[ch30-schedule-subscribe:editScheduleShareIcs] ics_id 必填');
  const r = await post('913scd/schedule/share/ics/edit', {
    ics_id: String(opts.ics_id),
    url: opts.url || '',
    name: opts.name || '',
  });
  if (r.code !== 200) throw new Error(`editScheduleShareIcs failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 取消日程分享（写操作）
 * 路由：913scd/schedule/share/cancel
 */
async function cancelScheduleShare(shareId, uid) {
  if (!shareId) throw new Error('[ch30-schedule-subscribe:cancelScheduleShare] shareId 必填');
  if (!uid) throw new Error('[ch30-schedule-subscribe:cancelScheduleShare] uid 必填');
  const r = await get('913scd/schedule/share/cancel', {
    share_id: String(shareId),
    uid: String(uid),
  });
  if (r.code !== 200) throw new Error(`cancelScheduleShare failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getScheduleShareFollowers,
  getScheduleSubscriptionSettings,
  updateScheduleSubscribers,
  getScheduleSubscriptionSubscribers,
  getScheduleShareIcsList,
  addScheduleShareIcs,
  deleteScheduleShareIcs,
  getScheduleShareIcsInfo,
  syncScheduleShareIcs,
  editScheduleShareIcs,
  cancelScheduleShare,
};
