/**
 * 讨论组管理
 * 路由来源：609usergroup.js (前缀 609usergroup)
 * 子模块 discuss/group/*
 */
const { get, post } = require('../../utils/request');

/**
 * 创建讨论组（写操作）
 * 路由：609usergroup/discuss/group/create
 */
async function createDiscuss(title, memberIds) {
  if (!title) throw new Error('[ch24-discuss:createDiscuss] title 必填');
  if (!Array.isArray(memberIds)) throw new Error('[ch24-discuss:createDiscuss] memberIds 必填');
  const r = await post('609usergroup/discuss/group/create', {
    title: String(title),
    member_ids: JSON.stringify(memberIds.map(String)),
  });
  if (r.code !== 200) throw new Error(`createDiscuss failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取讨论组信息
 * 路由：609usergroup/discuss/group/info
 */
async function getDiscussInfo(groupId) {
  if (!groupId) throw new Error('[ch24-discuss:getDiscussInfo] groupId 必填');
  const r = await post('609usergroup/discuss/group/info', { group_id: String(groupId) });
  if (r.code !== 200) throw new Error(`getDiscussInfo failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 加入讨论组（写操作）
 * 路由：609usergroup/discuss/group/user/join
 */
async function joinDiscuss(groupId, userId) {
  if (!groupId) throw new Error('[ch24-discuss:joinDiscuss] groupId 必填');
  if (!userId) throw new Error('[ch24-discuss:joinDiscuss] userId 必填');
  const r = await post('609usergroup/discuss/group/user/join', {
    group_id: String(groupId),
    user_id: String(userId),
  });
  if (r.code !== 200) throw new Error(`joinDiscuss failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 关注/取消关注讨论组
 * 路由：609usergroup/discuss/group/follow
 */
async function toggleFollowDiscuss(groupId, follow) {
  if (!groupId) throw new Error('[ch24-discuss:toggleFollowDiscuss] groupId 必填');
  const r = await post('609usergroup/discuss/group/follow', {
    group_id: String(groupId),
    follow: follow ? 1 : 0,
  });
  if (r.code !== 200) throw new Error(`toggleFollowDiscuss failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 解散讨论组（写操作）
 * 路由：609usergroup/discuss/group/dismiss
 */
async function dismissDiscuss(groupId) {
  if (!groupId) throw new Error('[ch24-discuss:dismissDiscuss] groupId 必填');
  const r = await post('609usergroup/discuss/group/dismiss', { group_id: String(groupId) });
  if (r.code !== 200) throw new Error(`dismissDiscuss failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 设置讨论组标题（写操作）
 * 路由：609usergroup/discuss/group/edit
 */
async function setDiscussTitle(groupId, title) {
  if (!groupId) throw new Error('[ch24-discuss:setDiscussTitle] groupId 必填');
  if (!title) throw new Error('[ch24-discuss:setDiscussTitle] title 必填');
  const r = await post('609usergroup/discuss/group/edit', {
    group_id: String(groupId),
    title: String(title),
  });
  if (r.code !== 200) throw new Error(`setDiscussTitle failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 添加成员到讨论组（写操作）
 * 路由：609usergroup/discuss/group/user/add
 */
async function addUserToDiscussion(groupId, userId) {
  if (!groupId) throw new Error('[ch24-discuss:addUserToDiscussion] groupId 必填');
  if (!userId) throw new Error('[ch24-discuss:addUserToDiscussion] userId 必填');
  const r = await post('609usergroup/discuss/group/user/add', {
    group_id: String(groupId),
    user_id: String(userId),
  });
  if (r.code !== 200) throw new Error(`addUserToDiscussion failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 讨论组消息列表
 * 路由：609usergroup/discuss/group/getMsgList
 */
async function getDiscussMsgList(groupId, opts = {}) {
  if (!groupId) throw new Error('[ch24-discuss:getDiscussMsgList] groupId 必填');
  const r = await post('609usergroup/discuss/group/getMsgList', {
    group_id: String(groupId),
    page: opts.page ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`getDiscussMsgList failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  createDiscuss,
  getDiscussInfo,
  joinDiscuss,
  toggleFollowDiscuss,
  dismissDiscuss,
  setDiscussTitle,
  addUserToDiscussion,
  getDiscussMsgList,
};
