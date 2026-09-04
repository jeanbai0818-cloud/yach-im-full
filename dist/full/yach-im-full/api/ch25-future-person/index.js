/**
 * 未来人社区
 * 路由来源：young.js (前缀 y)
 */
const { get, post } = require('../../utils/request');

/**
 * 获取未来人新帖数
 * 路由：y/young/newPost
 */
async function getYoungNewPost() {
  const r = await get('y/young/newPost', {});
  if (Number(r.code) !== 200) throw new Error(`getYoungNewPost failed: ${r.code} ${r.msg}`);
  const d = r.data || {};
  return { newPostCount: Number(d.new_post_count) || 0 };
}

/**
 * 获取未来人未读数
 * 路由：y/young/unread
 */
async function getYoungUnread() {
  const r = await get('y/young/unread', {});
  if (Number(r.code) !== 200) throw new Error(`getYoungUnread failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 是否加入未来人
 * 路由：y/squad/isjoinyoung
 */
async function isJoinYoung() {
  const r = await get('y/squad/isjoinyoung', {});
  if (Number(r.code) !== 200) throw new Error(`isJoinYoung failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 未来人最新帖子/社区动态
 * 路由：y/squad/newyoung
 */
async function getYoungNewSquad() {
  const r = await post('y/squad/newyoung', {});
  if (r.code !== 200) throw new Error(`getYoungNewSquad failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

module.exports = {
  getYoungNewPost,
  getYoungUnread,
  isJoinYoung,
  getYoungNewSquad,
};
