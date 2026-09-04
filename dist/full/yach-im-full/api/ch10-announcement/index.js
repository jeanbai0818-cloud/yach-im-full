/**
 * 群公告 CRUD
 * 路由来源：usergroup.js (前缀 usergroup)
 * 已验证：需通过 yach_get_group_info 获取 tid 后调用
 */
const { get, post } = require('../../utils/request');

/**
 * 获取群公告列表
 * 路由：usergroup/group/announcement/list
 */
async function getGroupAnnouncements(tid) {
  if (!tid) throw new Error('[ch10-announcement:getGroupAnnouncements] tid 必填');
  const r = await post('usergroup/group/announcement/list', { group_id: String(tid) });
  if (r.code !== 200) throw new Error(`getGroupAnnouncements failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 获取群公告详情
 * 路由：usergroup/group/announcement/info
 */
async function getGroupAnnouncementDetail(tid, announcementId) {
  if (!tid) throw new Error('[ch10-announcement:getGroupAnnouncementDetail] tid 必填');
  if (!announcementId) throw new Error('[ch10-announcement:getGroupAnnouncementDetail] announcementId 必填');
  const r = await post('usergroup/group/announcement/info', {
    group_id: String(tid),
    announcement_id: String(announcementId),
  });
  if (r.code !== 200) throw new Error(`getGroupAnnouncementDetail failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 新增群公告（写操作）
 * 路由：usergroup/group/announcement/add
 */
async function createGroupAnnouncement(tid, opts = {}) {
  if (!tid) throw new Error('[ch10-announcement:createGroupAnnouncement] tid 必填');
  if (!opts.title) throw new Error('[ch10-announcement:createGroupAnnouncement] title 必填');
  if (!opts.content) throw new Error('[ch10-announcement:createGroupAnnouncement] content 必填');
  const r = await post('usergroup/group/announcement/add', {
    group_id: String(tid),
    title: String(opts.title),
    content: String(opts.content),
    top: opts.top || 0,
  });
  if (r.code !== 200) throw new Error(`createGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 编辑群公告（写操作）
 * 路由：usergroup/group/announcement/info/edit
 */
async function updateGroupAnnouncement(tid, announcementId, opts = {}) {
  if (!tid) throw new Error('[ch10-announcement:updateGroupAnnouncement] tid 必填');
  if (!announcementId) throw new Error('[ch10-announcement:updateGroupAnnouncement] announcementId 必填');
  const r = await post('usergroup/group/announcement/info/edit', {
    group_id: String(tid),
    announcement_id: String(announcementId),
    title: opts.title,
    content: opts.content,
    top: opts.top,
  });
  if (r.code !== 200) throw new Error(`updateGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除群公告（写操作）
 * 路由：usergroup/group/announcement/delete
 */
async function deleteGroupAnnouncement(tid, announcementId) {
  if (!tid) throw new Error('[ch10-announcement:deleteGroupAnnouncement] tid 必填');
  if (!announcementId) throw new Error('[ch10-announcement:deleteGroupAnnouncement] announcementId 必填');
  const r = await post('usergroup/group/announcement/delete', {
    group_id: String(tid),
    announcement_id: String(announcementId),
  });
  if (r.code !== 200) throw new Error(`deleteGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 置顶/取消置顶群公告（写操作）
 * 路由：usergroup/group/announcement/info/top
 */
async function setGroupAnnouncementTop(tid, announcementId, top = 1) {
  if (!tid) throw new Error('[ch10-announcement:setGroupAnnouncementTop] tid 必填');
  if (!announcementId) throw new Error('[ch10-announcement:setGroupAnnouncementTop] announcementId 必填');
  const r = await post('usergroup/group/announcement/info/top', {
    group_id: String(tid),
    announcement_id: String(announcementId),
    is_top: Number(top),
  });
  if (r.code !== 200) throw new Error(`setGroupAnnouncementTop failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 公告阅读状态（谁读了公告）
 * 路由：usergroup/group/announcement/info/check
 */
async function getGroupAnnouncementCheck(tid, announcementId) {
  if (!tid) throw new Error('[ch10-announcement:getGroupAnnouncementCheck] tid 必填');
  if (!announcementId) throw new Error('[ch10-announcement:getGroupAnnouncementCheck] announcementId 必填');
  const r = await post('usergroup/group/announcement/info/check', {
    group_id: String(tid),
    announcement_id: String(announcementId),
  });
  if (r.code !== 200) throw new Error(`getGroupAnnouncementCheck failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  getGroupAnnouncements,
  getGroupAnnouncementDetail,
  createGroupAnnouncement,
  updateGroupAnnouncement,
  deleteGroupAnnouncement,
  setGroupAnnouncementTop,
  getGroupAnnouncementCheck,
};
