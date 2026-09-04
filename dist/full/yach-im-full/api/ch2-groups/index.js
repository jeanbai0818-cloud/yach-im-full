/**
 * 第二章：群组与团队
 * 前缀 94capi（群操作）+ 95search（群搜索）
 * 已验证：
 *   searchGroup  ✅ 95search/search/v2/gpsearch (querystr)
 *   getGroupInfo ⚠️  94capi/group/info/get (tid) — 需已加入该群，否则 40002
 *   getGroupUsers 🚧 94capi/group/users/list/get (tid)
 */
const { post, get } = require('../../utils/request');

/**
 * 搜索群组
 * @param {string} querystr 群名关键词
 */
async function searchGroup(querystr, opts = {}) {
  const r = await post('95search/search/v2/gpsearch', {
    querystr,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`searchGroup failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取群详情（需已加入该群）
 * @param {string} tid 群 tid（网易云信 teamId）
 */
async function getGroupInfo(tid) {
  const r = await post('94capi/group/info/get', { tid: String(tid) });
  if (r.code !== 200) throw new Error(`getGroupInfo failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取群成员列表（需已加入该群）
 * @param {string} tid
 */
async function getGroupUsers(tid, opts = {}) {
  const r = await post('94capi/group/users/list/get', {
    tid: String(tid),
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 50,
  });
  if (r.code !== 200) throw new Error(`getGroupUsers failed: ${r.code} ${r.msg}`);
  return r.obj;
}

// ─────────────────────────────────────────────────────────────
// 群管理写操作（路由来自 capi.js / 609usergroup.js 逆向；写操作前缀以 94capi 调用）
// ⚠️ 写操作：参数/前缀以逆向路由为准，首次真实调用需按返回码校准（标注 needs-verify）
// ─────────────────────────────────────────────────────────────

/**
 * 建普通群聊
 *
 * ⭐ 真实参数（home.js noRepeatCreateGroup 逆出，已实测）：
 *   POST 94capi/group/info/create
 *   { tname:<群名>, members:JSON.stringify([user_id数组]), color:<头像文字色>, label:<群名>, group_icon?:<url> }
 *   约束：成员 < 2 人时不建群（转 p2p）。members 不含自己（创建者自动加入），
 *   所以双人群 = members 放 1 个对方 + 自己 = 2 人，恰好满足。
 *   之前用 discuss/group/create + accids 前缀/参数均错。
 *
 * @param {string} name  群名
 * @param {(string|number)[]} members  成员 user_id 列表（不含自己）
 * @param {object} opts  { color?, groupIcon? }
 * @returns {Promise<object>} obj 含新群 tid
 */
async function createGroup(name, members = [], opts = {}) {
  // ⭐ 实测：color 字段传 '#3F8CFF' 这类值会报 10003；不传 color 则成功（后端自分配头像）。
  // members 不含自己（创建者自动加入）；members 含自己也会 10003。
  const body = {
    tname: name || '',
    members: JSON.stringify(members.map(String)),
    label: name || '',
  };
  if (opts.color)     body.color = opts.color;      // 需真实调色板值才行，默认不传
  if (opts.groupIcon) body.group_icon = opts.groupIcon;
  const r = await post('94capi/group/info/create', body);
  if (r.code !== 200) throw new Error(`createGroup failed: ${r.code} ${r.msg}`);
  return r.obj;  // 含 tid / id / owner / users_num
}

/**
 * 群加人
 * 路由：v2/group/users/add（609usergroup.js: groupUsersAdd）
 * @param {string} tid  群 tid
 * @param {string[]} accids  要加的成员 accid
 */
async function addGroupUsers(tid, accids = []) {
  // ⭐ 真实参数（home.js groupUsersAdd，实测）：字段是 users（非 accids）+ apply_flag:1
  const r = await post('94capi/v2/group/users/add', {
    tid: String(tid),
    users: JSON.stringify(accids.map(String)),
    apply_flag: 1,
  });
  if (r.code !== 200) throw new Error(`addGroupUsers failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 编辑群信息（群名等）
 * 路由：v2/group/info/edit（groupInfoEdit）
 */
async function editGroupInfo(tid, fields = {}) {
  // ⭐ 真实字段（home.js）：改名用 group_name（非 tname）；改头像 group_icon
  //   传入 { name } 会自动映射为 group_name（兼容）
  const body = { tid: String(tid), ...fields };
  if (body.name && !body.group_name) { body.group_name = body.name; delete body.name; }
  if (body.tname && !body.group_name) { body.group_name = body.tname; delete body.tname; }
  const r = await post('94capi/v2/group/info/edit', body);
  if (r.code !== 200) throw new Error(`editGroupInfo failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 退群
 * 路由：v2/group/users/quit（groupUsersQuit）
 */
async function quitGroup(tid) {
  const r = await post('94capi/v2/group/users/quit', { tid: String(tid) });
  if (r.code !== 200) throw new Error(`quitGroup failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 群禁言
 * 路由：v2/group/team/mute（groupShutUp）
 * @param {string} tid
 * @param {boolean} mute  true 开启全员禁言
 */
async function muteGroup(tid, mute = true) {
  const r = await post('94capi/v2/group/team/mute', { tid: String(tid), mute: mute ? 1 : 0 });
  if (r.code !== 200) throw new Error(`muteGroup failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 解散群
 * ⭐ 真实路由：`v2/group/info/dismiss`（capi.js，实测验证）——之前误用 discuss/group/dismiss
 */
async function dismissGroup(tid) {
  const r = await post('94capi/v2/group/info/dismiss', { tid: String(tid) });
  if (r.code !== 200) throw new Error(`dismissGroup failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 踢人（将成员移出群）
 * 路由：`v2/group/users/del`（capi.js）
 * @param {string} tid
 * @param {string[]} accids  要移出的成员 accid
 */
async function removeGroupUsers(tid, accids = []) {
  // ⭐ 真实参数（home.js groupUserDel）：字段是 users（非 accids）
  const r = await post('94capi/v2/group/users/del', {
    tid: String(tid), users: JSON.stringify(accids.map(String)),
  });
  if (r.code !== 200) throw new Error(`removeGroupUsers failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 转让群主
 * 路由：`v2/group/info/owner/change`（capi.js）
 * @param {string} tid
 * @param {string} newOwnerAccid  新群主 accid
 */
async function changeGroupOwner(tid, newOwnerAccid) {
  const r = await post('94capi/v2/group/info/owner/change', {
    tid: String(tid), new_owner: String(newOwnerAccid),
  });
  if (r.code !== 200) throw new Error(`changeGroupOwner failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 设置/取消管理员
 * 路由：`v2/group/users/admin/set` | `v2/group/users/admin/cancel`（capi.js）
 * @param {string} tid
 * @param {string[]} accids
 * @param {boolean} set  true 设置、false 取消
 */
async function setGroupAdmin(tid, accids = [], set = true) {
  const path = set ? '94capi/v2/group/users/admin/set' : '94capi/v2/group/users/admin/cancel';
  // ⭐ 真实参数（home.js groupUsersAdminSet）：字段是 `admin_users` 且 = JSON.stringify(数组)（非 accids，实测 10013 修正）
  const r = await post(path, { tid: String(tid), admin_users: JSON.stringify(accids.map(String)) });
  if (r.code !== 200) throw new Error(`setGroupAdmin failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 频道（Squad / 话题群）内容列表
 * 路由：94capi/squad/get_list（实测确认，非 609usergroup 前缀——那个报 404）
 * ⭐ 真实参数名 = **`squad_id`**（话题群独立 id，不是普通群的 tid）；
 *   实测：缺 squad_id 报 403“缺失话题群ID”；用普通群 tid 当 squad_id 报 40303“话题群已被删除”。
 * ⚠️ squad（频道/话题群）是独立业务实体，需真实 squad_id；逆向源未给创建/枚举 squad 的完整链。
 * @param {string} squadId 话题群 id（必填）
 */
async function listSquads(squadId, opts = {}) {
  if (!squadId) {
    throw new Error(`[ch2:listSquads] 需 squad_id：94capi/squad/get_list 需话题群独立 id（非普通群 tid），缺失报 403。squad 是独立实体，逆向源未给枚举链。`);
  }
  const r = await post('94capi/squad/get_list', {
    squad_id: String(squadId),
    page: opts.page ?? 1, pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`listSquads failed: ${r.code} ${r.msg}`);
  return r.obj;
}


// ─────────────────────────────────────────────────────────────
// 群公告 CRUD（usergroup 域名，群公告管理）
// 2026-07-21 真调验证：
//   list(group_id) ✅ 200 | info(group_id+announcement_id) ✅ 200
//   add(group_id+content) ✅ 200 | delete ✅ 200
//   info/top(group_id+announcement_id+is_top) ✅ 200
// ─────────────────────────────────────────────────────────────

/**
 * 列出群公告
 * 路由：usergroup/group/announcement/list
 * @param {string} groupId 群ID（usergroup API 的 group_id 字段）
 */
async function listGroupAnnouncement(groupId, opts = {}) {
  if (!groupId) throw new Error('[ch2:listGroupAnnouncement] 需 group_id');
  const r = await post('usergroup/group/announcement/list', {
    group_id: String(groupId),
    page: opts.page ?? 1, pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`listGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj || { list: [], total: 0 };
}

/**
 * 获取群公告详情
 * 路由：usergroup/group/announcement/info
 */
async function getGroupAnnouncement(groupId, announcementId) {
  if (!groupId) throw new Error('[ch2:getGroupAnnouncement] 需 group_id');
  if (!announcementId) throw new Error('[ch2:getGroupAnnouncement] 需 announcement_id');
  const r = await post('usergroup/group/announcement/info', {
    group_id: String(groupId),
    announcement_id: String(announcementId),
  });
  if (r.code !== 200) throw new Error(`getGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 新建群公告（写操作）
 * 路由：usergroup/group/announcement/add
 */
async function addGroupAnnouncement(opts = {}) {
  if (!opts.groupId) throw new Error('[ch2:addGroupAnnouncement] 需 groupId');
  if (!opts.content) throw new Error('[ch2:addGroupAnnouncement] 需 content');
  const r = await post('usergroup/group/announcement/add', {
    group_id: String(opts.groupId),
    content: opts.content,
    is_top: opts.isTop ?? 0,
    newer_must_read: opts.newerMustRead ?? 0,
    is_send_msg: opts.isSendMsg ?? 0,
    is_need_check: opts.isNeedCheck ?? 0,
    is_certified: opts.isCertified ?? 0,
  });
  if (r.code !== 200) throw new Error(`addGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除群公告（写操作）
 * 路由：usergroup/group/announcement/delete
 */
async function deleteGroupAnnouncement(groupId, announcementId) {
  if (!groupId) throw new Error('[ch2:deleteGroupAnnouncement] 需 group_id');
  if (!announcementId) throw new Error('[ch2:deleteGroupAnnouncement] 需 announcement_id');
  const r = await post('usergroup/group/announcement/delete', {
    announcement_id: String(announcementId),
    group_id: String(groupId),
  });
  if (r.code !== 200) throw new Error(`deleteGroupAnnouncement failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 置顶/取消置顶群公告
 * 路由：usergroup/group/announcement/info/top
 */
async function setGroupAnnouncementTop(groupId, announcementId, isTop = true) {
  if (!groupId) throw new Error('[ch2:setGroupAnnouncementTop] 需 group_id');
  if (!announcementId) throw new Error('[ch2:setGroupAnnouncementTop] 需 announcement_id');
  const r = await post('usergroup/group/announcement/info/top', {
    announcement_id: String(announcementId),
    group_id: String(groupId),
    is_top: isTop ? '1' : '0',
  });
  if (r.code !== 200 && r.code !== 40053) throw new Error(`setGroupAnnouncementTop failed: ${r.code} ${r.msg}`);
  return r.obj;
}

// ─────────────────────────────────────────────────────────────
// 入群申请管理（usergroup 域名）
// 2026-07-21 源码提取，待真调
// ─────────────────────────────────────────────────────────────

/**
 * 入群申请列表
 * 路由：usergroup/ug/group/apply/list
 * @param {string} groupId 群ID
 */
async function listGroupApply(groupId, opts = {}) {
  if (!groupId) throw new Error('[ch2:listGroupApply] 需 group_id');
  const r = await post('usergroup/ug/group/apply/list', {
    group_id: String(groupId),
    page: opts.page ?? 1, pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200 && r.code !== 10003) throw new Error(`listGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj || { list: [], total: 0 };
}

/**
 * 入群申请同意（写操作）
 * 路由：usergroup/ug/group/apply/accept
 */
async function acceptGroupApply(groupId, applyId) {
  if (!groupId) throw new Error('[ch2:acceptGroupApply] 需 group_id');
  if (!applyId) throw new Error('[ch2:acceptGroupApply] 需 apply_id');
  const r = await post('usergroup/ug/group/apply/accept', {
    group_id: String(groupId),
    apply_id: String(applyId),
  });
  if (r.code !== 200) throw new Error(`acceptGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 入群申请拒绝（写操作）
 * 路由：usergroup/ug/group/apply/reject
 */
async function rejectGroupApply(groupId, applyId) {
  if (!groupId) throw new Error('[ch2:rejectGroupApply] 需 group_id');
  if (!applyId) throw new Error('[ch2:rejectGroupApply] 需 apply_id');
  const r = await post('usergroup/ug/group/apply/reject', {
    group_id: String(groupId),
    apply_id: String(applyId),
  });
  if (r.code !== 200) throw new Error(`rejectGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 批量处理入群申请（写操作）
 * 路由：usergroup/ug/group/apply/batch
 * @param {object[]} applies [{apply_id, action(1通过/0拒绝)}]
 */
async function batchGroupApply(groupId, applies) {
  if (!groupId) throw new Error('[ch2:batchGroupApply] 需 group_id');
  if (!Array.isArray(applies)) throw new Error('[ch2:batchGroupApply] applies 需为数组');
  const r = await post('usergroup/ug/group/apply/batch', {
    group_id: String(groupId),
    applies: JSON.stringify(applies.map(a => ({ apply_id: String(a.apply_id), action: Number(a.action) }))),
  });
  if (r.code !== 200) throw new Error(`batchGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 忽略入群申请（写操作）
 * 路由：usergroup/ug/group/apply/ignore
 */
async function ignoreGroupApply(groupId, applyId) {
  if (!groupId) throw new Error('[ch2:ignoreGroupApply] 需 group_id');
  if (!applyId) throw new Error('[ch2:ignoreGroupApply] 需 apply_id');
  const r = await post('usergroup/ug/group/apply/ignore', {
    group_id: String(groupId),
    apply_id: String(applyId),
  });
  if (r.code !== 200) throw new Error(`ignoreGroupApply failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取入群申请数量
 * 路由：usergroup/ug/group/apply/count
 */
async function getGroupApplyCount(groupId) {
  if (!groupId) throw new Error('[ch2:getGroupApplyCount] 需 group_id');
  const r = await post('usergroup/ug/group/apply/count', {
    group_id: String(groupId),
  });
  if (r.code !== 200) throw new Error(`getGroupApplyCount failed: ${r.code} ${r.msg}`);
  return r.obj || { total: 0 };
}

/**
 * 获取入群申请配置
 * 路由：usergroup/ug/group/apply/config
 */
async function getGroupApplyConfig(groupId) {
  if (!groupId) throw new Error('[ch2:getGroupApplyConfig] 需 group_id');
  const r = await post('usergroup/ug/group/apply/config', {
    group_id: String(groupId),
  });
  if (r.code !== 200) throw new Error(`getGroupApplyConfig failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = {
  removeGroupUsers, changeGroupOwner, setGroupAdmin,
  searchGroup, getGroupInfo, getGroupUsers,
  createGroup, addGroupUsers, editGroupInfo, quitGroup, muteGroup, dismissGroup,
  listSquads,
  // 群公告 CRUD
  listGroupAnnouncement, getGroupAnnouncement, addGroupAnnouncement,
  deleteGroupAnnouncement, setGroupAnnouncementTop,
  // 入群申请
  listGroupApply, acceptGroupApply, rejectGroupApply,
  batchGroupApply, ignoreGroupApply, getGroupApplyCount, getGroupApplyConfig,
};
