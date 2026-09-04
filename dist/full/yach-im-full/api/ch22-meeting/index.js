/**
 * 腾讯会议/音视频
 * 路由来源：audio.js (前缀 612meeting)
 * 子模块 tencent/records/*
 */
const { get, post } = require('../../utils/request');

/**
 * 腾讯记录分享（写操作）
 * 路由：612meeting/tencent/records/share
 */
async function tencentRecordShare(opts = {}) {
  if (!opts.id) throw new Error('[ch22-meeting:tencentRecordShare] id 必填');
  const r = await post('612meeting/tencent/records/share', {
    id: String(opts.id),
    setting: opts.setting || {},
  });
  if (r.code !== 200) throw new Error(`tencentRecordShare failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 同步腾讯记录
 * 路由：612meeting/tencent/records/sync
 */
async function tencentRecordSync(opts = {}) {
  const r = await post('612meeting/tencent/records/sync', opts);
  if (r.code !== 200) throw new Error(`tencentRecordSync failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取腾讯记录信息
 * 路由：612meeting/tencent/records/info
 */
async function getTencentRecordInfo(recordId) {
  if (!recordId) throw new Error('[ch22-meeting:getTencentRecordInfo] recordId 必填');
  const r = await post('612meeting/tencent/records/info', { id: String(recordId) });
  if (r.code !== 200) throw new Error(`getTencentRecordInfo failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取分享设置
 * 路由：612meeting/tencent/records/share/setting
 */
async function getTencentShareSetting(recordId) {
  if (!recordId) throw new Error('[ch22-meeting:getTencentShareSetting] recordId 必填');
  const r = await post('612meeting/tencent/records/share/setting', { id: String(recordId) });
  if (r.code !== 200) throw new Error(`getTencentShareSetting failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取成员列表
 * 路由：612meeting/tencent/records/members/list
 */
async function getShareMemberList(recordId) {
  if (!recordId) throw new Error('[ch22-meeting:getShareMemberList] recordId 必填');
  const r = await post('612meeting/tencent/records/members/list', { id: String(recordId) });
  if (r.code !== 200) throw new Error(`getShareMemberList failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 添加成员（写操作）
 * 路由：612meeting/tencent/records/members/add
 */
async function addShareMember(recordId, userId) {
  if (!recordId) throw new Error('[ch22-meeting:addShareMember] recordId 必填');
  if (!userId) throw new Error('[ch22-meeting:addShareMember] userId 必填');
  const r = await post('612meeting/tencent/records/members/add', {
    id: String(recordId),
    user_id: String(userId),
  });
  if (r.code !== 200) throw new Error(`addShareMember failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除成员（写操作）
 * 路由：612meeting/tencent/records/members/del
 */
async function delShareMember(recordId, userId) {
  if (!recordId) throw new Error('[ch22-meeting:delShareMember] recordId 必填');
  if (!userId) throw new Error('[ch22-meeting:delShareMember] userId 必填');
  const r = await post('612meeting/tencent/records/members/del', {
    id: String(recordId),
    user_id: String(userId),
  });
  if (r.code !== 200) throw new Error(`delShareMember failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 刷新 Token
 * 路由：612meeting/tencent/refresh/token
 */
async function refreshTencentToken() {
  const r = await post('612meeting/tencent/refresh/token', {});
  if (r.code !== 200) throw new Error(`refreshTencentToken failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取腾讯会议信息
 * 路由：612meeting/client/meeting/info
 */
async function getTencentMeetingInfo(meetingId) {
  if (!meetingId) throw new Error('[ch22-meeting:getTencentMeetingInfo] meetingId 必填');
  const r = await get('612meeting/client/meeting/info', { id: String(meetingId) });
  if (r.code !== 200) throw new Error(`getTencentMeetingInfo failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取腾讯会议列表
 * 路由：612meeting/client/meeting/list
 */
async function getTencentMeetingList(opts = {}) {
  const r = await get('612meeting/client/meeting/list', {
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getTencentMeetingList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取会议摘要
 * 路由：612meeting/client/meeting/summary
 */
async function getTencentMeetingSummary(meetingId) {
  if (!meetingId) throw new Error('[ch22-meeting:getTencentMeetingSummary] meetingId 必填');
  const r = await get('612meeting/client/meeting/summary', { id: String(meetingId) });
  if (r.code !== 200) throw new Error(`getTencentMeetingSummary failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取链接消息摘要
 * 路由：612meeting/link/message/abstract
 */
async function getLinkMsgAbstract(url) {
  if (!url) throw new Error('[ch22-meeting:getLinkMsgAbstract] url 必填');
  const r = await post('612meeting/link/message/abstract', { url: String(url) });
  if (r.code !== 200) throw new Error(`getLinkMsgAbstract failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 房间呼叫
 * 路由：612meeting/client/rooms/call
 */
async function roomsCall(meetingId) {
  if (!meetingId) throw new Error('[ch22-meeting:roomsCall] meetingId 必填');
  const r = await post('612meeting/client/rooms/call', { id: String(meetingId) });
  if (r.code !== 200) throw new Error(`roomsCall failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  tencentRecordShare, tencentRecordSync, getTencentRecordInfo,
  getTencentShareSetting, getShareMemberList, addShareMember, delShareMember,
  refreshTencentToken, getTencentMeetingInfo, getTencentMeetingList,
  getTencentMeetingSummary, getLinkMsgAbstract, roomsCall,
};
