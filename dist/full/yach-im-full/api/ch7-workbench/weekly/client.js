/**
 * 周报客户端（mgo/log/* 接口）
 *
 * ⭐ 关键发现（纠正之前"周报在 okr-dd 独立系统"的误判）：
 *   周报根本不需要单独 SSO 换票——它就是标准知音楼 capi 接口，
 *   走 yach-capi.zhiyinlou.com，路径 /mgo/log/*（注意：不带 94capi 前缀），
 *   用当前项目的通用签名（sign.js）即可，直接 post() 就通。
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 weekly/client.js，改写为 CJS。
 * 旧包 apiBaseUrl=https://yach-capi.zhiyinlou.com，周报路径 /mgo/log/*。
 */
'use strict';

const { post } = require('../../../utils/request');

// 周报接口路径（mgo/log/*，无 94capi 前缀）
const PATHS = {
  draftGet: 'mgo/log/draft/get',
  draftSave: 'mgo/log/draft/save',   // ⭐ 仅保存草稿；不能据此判断周报已提交
  detailSave: 'mgo/log/detail/save', // ⭐ 桌面端「提交」真实接口；成功必须返回 weekly_id
  getSalt: 'mgo/get/salt',
  sendWeeklyShare: 'mgo/log/send/weekly/share', // 桌面端提交成功后的群通知步骤
  template: 'mgo/log/template',      // ⭐ 周报模板类型映射（2普通/3OKR/6复盘 + selected），比 template/list 全
  lastSend: 'mgo/log/get/last/send', // ⭐ 上次发送的周报（带完整 content 段，“参考上次”用）真调 2026-07-13
  getTime: 'mgo/log/get/time',       // ⭐ 当前周期时间 {time}
  reportEmployee: 'mgo/log/report/employee', // ⭐ 上报对象列表（我该发给谁，id/name/work_code/dept）
  filterSearch: 'mgo/log/filtersearch',      // 按指定用户查周报（search_user_ids[]，支持真实分页）
  apply: 'mgo/log/apply',                    // ⭐ 权限校验（target_user_ids[] → authority/unauthority）
  receiveGet: 'mgo/log/receive/get',
  receiveSet: 'mgo/log/receive/set',
  receiveAll: 'mgo/log/receive/all',
  eventList: 'mgo/log/event/list',  // 我的周报收到的互动动态（点赞/评论），真调验证 2026-07-13
  getWeeks: 'mgo/log/get/weeks',   // 周报周期列表
  sendList: 'mgo/log/send/list',
  templateList: 'mgo/log/template/list', // 旧路径，只返 2 类且无 selected；改用 template
  detailGet: 'mgo/log/detail/get',
  readed: 'mgo/log/readed',
  readedList: 'mgo/log/readed/list',
  starList: 'mgo/log/mystarlist',
  zan: 'mgo/log/zan',       // 点赞（只需 log_id）
  cancelzan: 'mgo/log/cancelzan',  // ⭐ 取消点赞（只需 log_id，真调验证 2026-07-13 →200）
  zanlist: 'mgo/log/zanlist',      // 某周报点赞人列表（log_id → {id,name,pic,dd_id,uuid}）
  commentlist: 'mgo/log/commentlist',  // 某周报评论列表
  commentAdd: 'mgo/log/comment/add',   // ⭐ 给周报评论（真调确认参数 {log_id, comment} → 200，2026-07-13）
  delComment: 'mgo/log/delcomment',    // ⭐ 删除评论（真调确认参数 {log_id, comment_id} → 200，comment_id 取评论列表的 remake_id）
  reportCategory: 'mgo/log/report/category', // ⭐ 上报对象分类（上级/同级/我的上报/默认收件）真调 200
  userFans: 'mgo/log/userfans',        // ⭐ 关注某人的周报（真调确认参数 {star_userid} → 200 {num:1}，2026-07-13）
  cancelFans: 'mgo/log/cancelfans',    // ⭐ 取消关注（真调确认参数 {star_userid} → 200）
  unreadList: 'mgo/log/unread/list',   // 未读周报列表
  readzanList: 'mgo/log/readzan/list', // ⭐ 批量查多篇的点赞/已读明细（参数 log_ids[] 数组，真调验证 2026-07-13）
  share: 'mgo/log/share',   // 转发/分享
};

async function call(path, body = {}) {
  const r = await post(path, body);
  if (Number(r.code || 0) !== 200) {
    throw new Error(`周报接口 ${path} 调用失败：${r.code} ${r.msg || ''}`);
  }
  return r.obj ?? r.data ?? r;
}

module.exports = {
  PATHS,

  /**
   * ⭐ 上次发送的周报（指定 template_type）—— mgo/log/get/last/send，真调验证 2026-07-13。
   * 带完整 content/content_full 段，用于“参考上次周报”。
   */
  readLastSend(templateType) {
    const body =
      templateType === undefined || templateType === null || String(templateType).trim() === ''
        ? {}
        : { template_type: String(templateType).trim() };
    return call(PATHS.lastSend, body);
  },

  /** ⭐ 当前周期时间 {time} */
  readTime() {
    return call(PATHS.getTime, {});
  },

  /** ⭐ 上报对象列表（我该把周报发给谁）*/
  readReportEmployees() {
    return call(PATHS.reportEmployee, {});
  },

  /**
   * ⭐⭐ 按指定人查周报 —— mgo/log/filtersearch，真调验证 2026-07-13。
   * search_user_ids[] = 目标用户 id（可多个，来自 usersearch/yach_search_users 的 id）。
   * ⚠️ 与 receive/all 本质不同：**真分页**（page/size 生效，page1/page2 不重叠），能翻完某人全部历史周报。
   * 返回对象结构同 receive/all（完整 content/content_full/template_type/send_user_id 等）。
   * 需先有查看权限（见 checkAuthority），否则可能返空。
   * @param userIds 目标用户 id 数组
   * @param page 页码（真分页）
   * @param size 每页条数
   * @param unRead 0=全部 1=仅未读
   */
  filterSearch(userIds, page = 1, size = 10, unRead = 0) {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String);
    return call(PATHS.filterSearch, { page, size, un_read: unRead, 'search_user_ids[]': ids });
  },

  /**
   * ⭐ 周报查看权限校验 —— mgo/log/apply，真调验证 2026-07-13。
   * target_user_ids[] → {authority_user_list:[有权限], unauthority_user_list:[无权限]}。
   */
  checkAuthority(userIds) {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String);
    return call(PATHS.apply, { 'target_user_ids[]': ids });
  },

  /**
   * 读周报模板列表 —— 真调 mgo/log/template（2普通/3OKR/6复盘 + selected 当前选中）。
   * ⚠️ 比旧 template/list 全（后者漏 OKR周报、无 selected）。
   */
  readTemplates() {
    return call(PATHS.template, {});
  },

  /** 读草稿（template_type 可选）*/
  readDraft(templateType) {
    const body =
      templateType === undefined || templateType === null || String(templateType).trim() === ''
        ? {}
        : { template_type: String(templateType).trim() };
    return call(PATHS.draftGet, body);
  },

  /** 读收件配置（默认发给谁）*/
  readReceiveConfig() {
    return call(PATHS.receiveGet, {});
  },

  /** 已发送周报列表 */
  readSentList(page = 1, limit = 20) {
    return call(PATHS.sendList, { page, limit });
  },

  /**
   * ⭐ 我接收的周报列表（他人发给我的）—— 真调验证 2026-07-13
   * ≠ send/list（那是我发出的）。从 weekly-pc 前端 bundle 逆出，走同一套 capi 签名，
   * 不需 CDP/openapi/muse_token，直接 post 就通。
   * ⚠️ 同 send/list 服务端硬固定返回最近 ~10 篇，忽略 page/limit。
   * 返回里的 _id 可直接用于 zan / detail/get（给他人周报点赞）。
   */
  readReceivedList(page = 1, limit = 20) {
    return call(PATHS.receiveAll, { page, limit });
  },

  /**
   * ⭐ 我的周报收到的互动动态（谁给我点赞/评论了）—— 真调验证 2026-07-13
   * action_type：2=点赞、1=评论、4=其他。⚠️ 服务端一次全返，忽略 page/limit。
   */
  readEventList(page = 1, limit = 200) {
    return call(PATHS.eventList, { page, limit });
  },

  /** 周报周期列表（start_time/end_time 秒时间戳） */
  readWeeks() {
    return call(PATHS.getWeeks, {});
  },

  /** 收藏（星标）周报列表 */
  readStarList(page = 1, limit = 20) {
    return call(PATHS.starList, { page, limit });
  },

  /** 周报详情 */
  readDetail(logId) {
    return call(PATHS.detailGet, { log_id: String(logId) });
  },

  /** 谁读过这篇周报 */
  readReaders(logId) {
    return call(PATHS.readedList, { log_id: String(logId) });
  },

  /** 标记已读（写操作）*/
  markRead(logId) {
    return call(PATHS.readed, { log_id: String(logId) });
  },

  /**
   * 存草稿（写操作）—— mgo/log/draft/save，form-urlencoded。
   * CDP 复核：桌面端提交另走 mgo/log/detail/save，draft/save 返回 200 只代表草稿保存。
   * body 里的 content / content_full 是 JSON 字符串数组，逐段 {title,content,oId,krId,okrTitle,isHi,count_word}。
   * ⭐ 原子哲学：整块 body 原样透传，不在此拼段落/绑 OKR 业务逻辑（交给 Agent 层）。
   */
  saveDraft(body) {
    return call(PATHS.draftSave, body || {});
  },

  /** 提交一篇新周报。与 draft/save 完全不同，成功响应包含 weekly_id。 */
  submitWeekly(body) {
    return call(PATHS.detailSave, body || {});
  },

  /** 获取现有周报的分享盐值（补发通知或分享时使用）。 */
  getWeeklySalt(logId) {
    return call(PATHS.getSalt, { log_id: String(logId) });
  },

  /**
   * 向群会话推送已创建的周报。该步骤不会再次创建周报。
   * 数组字段必须使用 [] 键名；普通 querystring 数组会导致服务端只保留最后一项。
   */
  sendWeeklyToGroups(logId, groupIds, saltValue) {
    return call(PATHS.sendWeeklyShare, {
      log_id: String(logId),
      'share_group_ids[]': (Array.isArray(groupIds) ? groupIds : [groupIds]).map(String),
      salt_value: String(saltValue),
    });
  },

  /** 给周报点赞（写操作）*/
  zanWeekly(logId) {
    return call(PATHS.zan, { log_id: String(logId) });
  },

  /** ⭐ 取消周报点赞（写操作，真调验证）*/
  cancelZanWeekly(logId) {
    return call(PATHS.cancelzan, { log_id: String(logId) });
  },

  /** 某周报的点赞人列表 */
  readZanList(logId) {
    return call(PATHS.zanlist, { log_id: String(logId) });
  },

  /** 某周报的评论列表 */
  readCommentList(logId) {
    return call(PATHS.commentlist, { log_id: String(logId) });
  },

  /**
   * ⭐ 给周报评论 —— mgo/log/comment/add，真调确认参数 2026-07-13。
   * 参数：{log_id, comment}（注意是 comment 不是 content）。可选 remark_to_id/remark_to_name 回复某条评论。
   * 返回 {num:{}}。真写操作（对方会看到评论 + 收到提醒）。
   */
  addComment(logId, comment, opts = {}) {
    const body = { log_id: String(logId), comment: String(comment) };
    if (opts.remarkToId) body.remark_to_id = String(opts.remarkToId);
    if (opts.remarkToName) body.remark_to_name = String(opts.remarkToName);
    return call(PATHS.commentAdd, body);
  },

  /**
   * ⭐ 删除评论 —— mgo/log/delcomment，真调确认参数 2026-07-13。
   * 参数：{log_id, comment_id}（comment_id = 评论列表里的 remake_id 字段）。只能删自己的评论。
   */
  removeComment(logId, commentId) {
    return call(PATHS.delComment, { log_id: String(logId), comment_id: commentId });
  },

  /** ⭐ 上报对象分类（上级/同级/我的上报对象/默认收件人）*/
  readReportCategory() {
    return call(PATHS.reportCategory, {});
  },

  /**
   * ⭐ 关注某人的周报 —— mgo/log/userfans，真调确认参数 2026-07-13。
   * 参数：{star_userid}（“关注的人”=star_userid，与 mystarlist 收藏一脉相承）。返回 {num:1}。
   */
  followUser(userId) {
    return call(PATHS.userFans, { star_userid: String(userId) });
  },

  /** ⭐ 取消关注 —— mgo/log/cancelfans，参数同 followUser。*/
  unfollowUser(userId) {
    return call(PATHS.cancelFans, { star_userid: String(userId) });
  },

  /** 未读周报列表 */
  readUnreadList(page = 1, limit = 20) {
    return call(PATHS.unreadList, { page, limit });
  },

  /**
   * ⭐ 批量查多篇周报的点赞/已读明细—— 真调验证 2026-07-13
   * ⚠️ 参数必须是 `log_ids[]` 数组形式（传 log_id 单数会 400）。
   * 返回 {周报id: {zan_list:[...], read_list:[...]}} 映射。比逐篇 zanlist 高效。
   */
  readZanReadBatch(logIds) {
    const ids = Array.isArray(logIds) ? logIds.map(String) : [String(logIds)];
    return call(PATHS.readzanList, { 'log_ids[]': ids });
  },
};
