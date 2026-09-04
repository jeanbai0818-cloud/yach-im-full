/**
 * 第八章：通知与提醒
 * 前缀 bsvr（bsvr.js 逆向 + home.js 调用上下文 + 实测，2026-07-12）
 * 已真调验证：
 *   getRemindList ✅ bsvr/remind/feed/list POST（返回 {data,page}）
 * ⚠️ 需真实 aide_id 上下文（客户端取自 window.session_active.id），本地无法空调：
 *   getRemindStatus — home.js 真实参数 {aide_id}，缺失报 10011/10003
 *   getAideMsgList  — export key = weekAssitentList（周报助手），需 aide 上下文，空调报 120005
 *   getScheduleReminds — 需具体 id，空调报 30014
 */
const { post, get } = require('../../utils/request');

/**
 * 获取提醒/通知列表
 */
async function getRemindList(opts = {}) {
  const r = await post('bsvr/remind/feed/list', {
    cp_id: 1,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
    ...opts.extra,
  });
  if (r.code !== 200) throw new Error(`getRemindList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取工作助手（周报助手）消息列表
 * ⚠️ 需真实 aide_id（助手会话 id），空调报 120005 “助手参数错误”。
 *   传入 opts.aide_id 才能真实调用（home.js：weekAssitentList）。
 */
async function getAideMsgList(opts = {}) {
  if (!opts.aide_id) {
    throw new Error(`[ch8:getAideMsgList] 缺 aide_id：bsvr/aide/msg/list 需真实助手会话 id（客户端取自 session_active），空调报 120005。`);
  }
  const r = await post('bsvr/aide/msg/list', {
    aide_id:  opts.aide_id,
    cp_id: 1,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
    ...opts.extra,
  });
  if (r.code !== 200) throw new Error(`getAideMsgList failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取提醒配额（只读）
 * 路由：remindUserQuota = bsvr/remind/user/quota
 * 实测返回 {message:1000, phone:1000}（message=应用内/短信额度，phone=电话额度）
 */
async function getRemindQuota() {
  const r = await post('bsvr/remind/user/quota', { cp_id: 1 });
  if (r.code !== 200) throw new Error(`getRemindQuota failed: ${r.code} ${r.msg}`);
  return r.obj; // { message, phone }
}

/**
 * 创建提醒（写操作）—— 知音楼"新建提醒"，支持 应用内/短信/电话 三种。
 * 路由：remindCreate = bsvr/remind/feed/create
 * 真实参数（home.js 逆出）：{ content, remind_type, uids, attachment, remind_source_type, remind_source, msg_id, ext }
 *
 * ⭐ remind_type 映射（home.js UI onClick 实证）：
 *   "0" = 应用内提醒（默认，remindSelectType 初始 0）
 *   "1" = 短信提醒（onClick h("1", messageNum)）
 *   "2" = 电话提醒（onClick h("2", phoneNum)）⭐
 *
 * @param {object}   opts
 * @param {string}   opts.content       提醒内容（必填，≤1000 字）
 * @param {string[]} opts.uids          接收人 user.id 数组（必填）
 * @param {string}   [opts.remindType]  "0"应用内 / "1"短信 / "2"电话，默认 "0"
 * @param {string}   [opts.msgId]       关联消息 id（可选，"对某条消息发提醒"）
 * @param {number}   [opts.sourceType]  remind_source_type（可选）
 * @param {string}   [opts.source]      remind_source（可选）
 * @param {string}   [opts.attachment]  附件（可选）
 * @param {object}   [opts.ext]         扩展字段（可选）
 */
async function createRemind(opts = {}) {
  const { content, uids, remindType = '0', msgId, sourceType, source, attachment, ext } = opts;
  if (!content) throw new Error('[ch8:createRemind] content 必填');
  if (!Array.isArray(uids) || !uids.length) throw new Error('[ch8:createRemind] uids 必填（接收人 user.id 数组）');
  const data = {
    content: String(content),
    remind_type: String(remindType),
    uids: uids.map(String).join(','),   // home.js: r.map(e=>e.id).join(',')
    cp_id: 1,
  };
  if (msgId != null)      data.msg_id = String(msgId);
  if (sourceType != null) data.remind_source_type = sourceType;
  if (source != null)     data.remind_source = source;
  if (attachment != null) data.attachment = attachment;
  if (ext != null)        data.ext = typeof ext === 'string' ? ext : JSON.stringify(ext);
  const r = await post('bsvr/remind/feed/create', data);
  if (r.code !== 200) throw new Error(`createRemind failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 撤回提醒（写操作）
 * 路由：remindRecall = bsvr/remind/feed/revoke
 */
async function recallRemind(rid) {
  if (!rid) throw new Error('[ch8:recallRemind] rid 必填');
  const r = await post('bsvr/remind/feed/revoke', { rid: String(rid), cp_id: 1 });
  if (r.code !== 200) throw new Error(`recallRemind failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 确认提醒（写操作）
 * 路由：remind/feed/confirm（remindFeedConfirm）
 */
async function confirmRemind(feedId) {
  const r = await post('bsvr/remind/feed/confirm', { feed_id: String(feedId), cp_id: 1 });
  if (r.code !== 200) throw new Error(`confirmRemind failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取提醒 App 状态
 * 路由：aide/remind/get_status（home.js 真实参数 {aide_id}）
 * ⚠️ 需真实 aide_id，空调报 10011/10003。
 */
async function getRemindStatus(aideId) {
  if (!aideId) {
    throw new Error(`[ch8:getRemindStatus] 缺 aide_id：home.js 实际传 {aide_id: session_active.id}，空调报 10011。`);
  }
  const r = await post('bsvr/aide/remind/get_status', { aide_id: aideId });
  if (r.code !== 200) throw new Error(`getRemindStatus failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 日程提醒（schedule/remind，913scd 前缀）
 * ⚠️ 真相：这是针对**具体日程**的提醒操作（需 event id），不是“查提醒列表”；
 *   空调报 30014 id参数错误。查提醒列表请用 getRemindList（feed/list 已真调通）。
 * @param {string} eventId 日程 id（必填）
 */
async function getScheduleReminds(eventId, opts = {}) {
  if (!eventId) {
    throw new Error(`[ch8:getScheduleReminds] 需日程 id：schedule/remind 是针对具体日程的提醒操作，空调报 30014。查提醒列表用 getRemindList。`);
  }
  const r = await post('913scd/schedule/remind', { id: String(eventId), cp_id: 1, ...opts });
  if (r.code !== 200) throw new Error(`getScheduleReminds failed: ${r.code} ${r.msg}`);
  return r.obj;
}


/**
 * 获取顶部提示栏消息（正在进行的会议/直播横幅）
 * 路由：bsvr/promptBarMsg/list GET
 * 返回 {total, meeting_list, living_list}
 */
async function getPromptBar() {
  const r = await get('bsvr/promptBarMsg/list', {});
  if (r.code !== 200) throw new Error(`getPromptBar failed: ${r.code} ${r.msg}`);
  return r.obj || { total: 0, meeting_list: [], living_list: [] };
}

module.exports = {
  getRemindList, getAideMsgList, confirmRemind, getRemindStatus, getScheduleReminds,
  getRemindQuota, createRemind, recallRemind, getPromptBar };
