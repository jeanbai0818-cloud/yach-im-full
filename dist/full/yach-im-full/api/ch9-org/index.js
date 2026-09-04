/**
 * 第九章：用户、组织与系统基础
 * 已验证接口：
 *   searchUser     ✅ 95search/search/usersearch (POST, querystr)
 *   getOrgUsers    ✅ 94capi/organ/info/users/list (POST)
 *   refreshToken   ✅ usergroup/account/refresh/token (POST)
 *   getInitData    ✅ 609usergroup/user/init/data (GET)
 *   getDeptList    ⚠️  94capi/organ/info/dept/list → 10037 (可能需要管理员权限)
 */
const { get, post } = require('../../utils/request');
const { loadSession } = require('../../auth/session');

/**
 * 搜索用户
 * @param {string} querystr 搜索关键词
 * @param {object} opts  { page=1, pagesize=20, on_job=1, external_search=0 }
 * @returns {Promise<{total,list}>}
 */
async function searchUser(querystr, opts = {}) {
  const r = await post('95search/search/usersearch', {
    querystr,
    page:            opts.page        ?? 1,
    pagesize:        opts.pagesize    ?? 20,
    on_job:          opts.on_job      ?? 1,
    external_search: opts.external_search ?? 0,
  });
  if (r.code !== 200) throw new Error(`searchUser failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取用户名片（个人卡片完整数据，点头像弹出的数据源）
 * ✅ 94capi/ucenter/user/info/get { user_id }（真调验证 2026-07-13）
 * 含：邮箱/手机/职级/部门/汇报对象/忙闲状态/价值观标签/工位、
 *   以及 OKR/周报/成长/工卡/考勤等深链。
 * @param {number|string} userId 用户 user.id
 */
async function getUserCard(userId) {
  const session = loadSession();
  const resolvedUserId = userId ?? session.user?.id ?? session.uid;
  if (!resolvedUserId || !Number.isFinite(Number(resolvedUserId))) {
    throw new Error('getUserCard 缺少有效 userId，且当前 session 未包含 user.id。');
  }
  const r = await post('94capi/ucenter/user/info/get', { user_id: Number(resolvedUserId) });
  if (r.code !== 200) throw new Error(`getUserCard failed: ${r.code} ${r.msg}`);
  const o = r.obj || {};
  // 提取深链里的真实 URL（去掉 yach:// webview 包装）
  const unwrap = (link) => {
    if (!link) return '';
    const m = /[?&]url=([^&]+)/.exec(link);
    return m ? decodeURIComponent(m[1]) : link;
  };
  return {
    id: o.id,
    name: o.name,
    nameEn: o.name_en,
    workCode: o.work_code,
    position: o.position,
    empType: o.emptype,
    level: o.level,
    email: o.full_email || o.email,
    mobile: o.mobile,
    avatar: o.pic,
    uuid: o.uuid,
    entryDate: o.cdate,
    company: o.cp_name,
    deptFullName: Array.isArray(o.dept_names) ? o.dept_names[0] : o.dept_name,
    deptPath: Array.isArray(o.new_dept_name) ? o.new_dept_name.map((d) => d.name) : [],
    reportsTo: o.reports_to,
    reportsToWorkCode: o.reports_to_workcode,
    isManager: o.is_manager === 1,
    workState: o.work_content || o.busyinfo || '',
    workEmoji: o.work_emoji || '',
    valuesTag: o.values_tag && o.values_tag.values_tag_name,
    officeAddr: o.office_addr
      || (o.base_addr && Array.isArray(o.base_addr.list) && o.base_addr.list[0]
        ? o.base_addr.list[0].name
        : ''),
    station: Array.isArray(o.station) && o.station[0] ? o.station[0].station_no : '',
    okrUrl: unwrap(o.okr_link),
    weeklyUrl: unwrap(o.weekly_link),
    growthUrl: unwrap(o.future_link),
    workCardUrl: o.work_card && o.work_card.link,
    isShowWeekly: o.is_show_weekly === 1,
    raw: o,
  };
}

/**
 * 获取部门成员列表
 * @param {string} departmentId
 */
async function getOrgUsers(departmentId, page = 1, pagesize = 50) {
  const r = await post('94capi/organ/info/users/list', {
    cp_id: 1, department_id: departmentId, page, pagesize,
  });
  if (r.code !== 200) throw new Error(`getOrgUsers failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 刷新 NIM 凭证（同时返回用户完整信息）
 */
async function refreshToken() {
  const r = await post('usergroup/account/refresh/token', {});
  if (r.code !== 200) throw new Error(`refreshToken failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取初始化配置数据
 */
async function getInitData() {
  const r = await get('609usergroup/user/init/data', {});
  if (r.code !== 200) throw new Error(`getInitData failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 根据 uuid 批量查用户信息
 * 路由：organ/info/users/uuidlist（organInfoUsersUuidlist）
 * @param {string[]} uuids
 */
async function getUsersByUuid(uuids = []) {
  const r = await post('94capi/organ/info/users/uuidlist', {
    cp_id: 1, uuids: JSON.stringify(uuids),
  });
  if (r.code !== 200) throw new Error(`getUsersByUuid failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取下级部门列表（组织架构树）
 * 路由：organ/info/dept/next/list（organInfoDeptNextList）
 * @param {string} parentDeptId  父部门 id（顶级传空或 0）
 */
async function getSubDepts(parentDeptId = '0') {
  const r = await post('94capi/organ/info/dept/next/list', {
    cp_id: 1, department_id: String(parentDeptId),
  });
  if (r.code !== 200) throw new Error(`getSubDepts failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 多部门信息
 * 路由：organ/info/multidept/list（organInfoMultideptList）
 */
async function getMultiDepts(deptIds = []) {
  const r = await post('94capi/organ/info/multidept/list', {
    cp_id: 1, department_ids: JSON.stringify(deptIds),
  });
  if (r.code !== 200) throw new Error(`getMultiDepts failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 查 token 状态
 * 路由：ucenter/user/get/token/status（ucenterUserGetTokenStatus）
 */
async function getTokenStatus() {
  const r = await post('94capi/ucenter/user/get/token/status', {});
  if (r.code !== 200) throw new Error(`getTokenStatus failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 设置用户状态/信息（写操作）
 * 路由：ucenter/user/info/save（ucenterUserInfoSave）
 * @param {object} fields  要更新的字段（如 status/signature 等）
 */
async function setUserInfo(fields = {}) {
  if (fields.pic != null) {
    let avatarUrl;
    try {
      avatarUrl = new URL(String(fields.pic));
    } catch {
      throw new Error('头像 pic 必须是有效的 HTTPS URL。');
    }
    if (avatarUrl.protocol !== 'https:' || avatarUrl.hostname !== 'yach-static.zhiyinlou.com') {
      throw new Error('头像 pic 仅允许使用 https://yach-static.zhiyinlou.com 域名。');
    }
  }
  const r = await post('94capi/ucenter/user/info/save', { ...fields });
  if (r.code !== 200) throw new Error(`setUserInfo failed: ${r.code} ${r.msg}`);
  return r.obj;
}


/**
 * 获取服务端联系人/群组列表（94capi/ucenter/user/connect/list）
 * 注意：POST 返回 list，但 total 字段为 0（服务端 bug）
 * 返回 [{id, name, type, dept_name, email, external_flag, connect_date, connect_num}]
 */
async function listContacts(opts = {}) {
  const { page = 1, size = 100 } = opts;
  const r = await post('94capi/ucenter/user/connect/list', { page, size });
  if (r.code !== 200) throw new Error(`listContacts failed: ${r.code} ${r.msg}`);
  const list = r.obj?.list || [];
  return { list, total: list.length };
}

module.exports = {
  searchUser, getUserCard, getOrgUsers, refreshToken, getInitData,
  getUsersByUuid, getSubDepts, getMultiDepts, getTokenStatus, setUserInfo,
  // ⭐ 新增（2026-07-14）
  getUsersByIdList,   // 按 user_id 批量查用户（比 getUsersByUuid 更常用）
  getPlatformConfig,  // 平台动态配置（含 decr_config_key）
  getAccountInfo,     // 账户完整信息 + 最新 jwttoken
  // ⭐ 新增（2026-07-14 第二批）
  getUserConfig,      // 用户个人配置（AI助手、搜索布局等）
  getValueTags,       // 公司价值观标签列表
  getYoungNewPost,    // 未来人新帖数
  // ⭐ 新增（2026-07-21）
  listWorkstates,     // 列出工作状态列表（bsvr/workstate/list）
  setWorkstate,       // 激活工作状态（bsvr/workstate/use，写操作）
  listContacts,       // 服务端联系人列表（94capi/ucenter/user/connect/list）
  getWorkstateInfo,   // 获取工作状态详情（bsvr/workstate/info，含自动回复）
};

/**
 * 列出工作状态列表（知音楼"我的状态"面板数据）
 * 路由：bsvr/workstate/list（真调验证 2026-07-21，code=200）
 * 返回字段：wuc_id / emoji / content / checked(1=当前激活) / custom(0=系统/1=自定义)
 *         / auto_reply / replyInfo.content.reply_content / start_time / end_time
 * @returns {Promise<Array>} 工作状态列表
 */
async function listWorkstates() {
  const r = await post('bsvr/workstate/list', {});
  if (r.code !== 200) throw new Error(`listWorkstates failed: ${r.code} ${r.msg}`);
  return (r.obj || []).map(s => ({
    id:           s.wuc_id,
    emoji:        s.emoji || '',
    content:      s.content || '',
    isActive:     s.checked === 1,
    isCustom:     s.custom === 1,
    autoReply:    s.auto_reply === 1,
    autoReplyText: s.replyInfo?.content?.reply_content || '',
    startTime:    s.start_time !== '0' ? Number(s.start_time) : null,
    endTime:      s.end_time   !== '0' ? Number(s.end_time)   : null,
    raw:          s,
  }));
}

/**
 * 激活某个工作状态（点击"我的状态"里某一项）
 * 路由：bsvr/workstate/use（真调验证 2026-07-21，code=200）
 * 写操作：真实改变自己在他人名片/消息页显示的状态。
 * @param {string} wucId  工作状态 id（从 listWorkstates 的 id 字段获取）
 * @returns {Promise<object>}
 */
async function setWorkstate(wucId) {
  const r = await post('bsvr/workstate/use', { wuc_id: String(wucId) });
  if (r.code !== 200) throw new Error(`setWorkstate failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 根据 user_id 批量查用户信息（简化字段：头像/姓名/uuid）
 * 路由：94capi/organ/info/users/idlist（抚包看到，真调验证 2026-07-14）
 * 对比 getUsersByUuid：这个拿 user_id（数字），更常用
 * @param {number[]|string[]} userIds  user_id 数组
 * @returns {Promise<Array<{id,name,pic,uuid,name_en,i18n_name}>>}
 */
async function getUsersByIdList(userIds = []) {
  if (!userIds.length) return [];
  const r = await post('94capi/organ/info/users/idlist', {
    corp_id: 1,
    user_ids: JSON.stringify(userIds.map(Number)),
  });
  if (r.code !== 200) throw new Error(`getUsersByIdList failed: ${r.code} ${r.msg}`);
  return (r.obj && r.obj.list) || [];
}

/**
 * 获取平台动态配置（含 decr_config_key 等加密配置）
 * 路由：94capi/platform/config/get（真调验证 2026-07-14）
 *
 * 重要键对应（从抓包真实响应推断）：
 *   10000 → cp_id=1 公司配置
 *     100000013 → decr_config_key（解密系统配置的 AES-128-ECB key）
 *     100000001/2 → 主功能 key（如 NIM appkey 等加密存储）
 *
 * @returns {Promise<{rawConfig: object, decrConfigKey: string|null}>}
 */
async function getPlatformConfig() {
  const r = await post('94capi/platform/config/get', {});
  if (r.code !== 200) throw new Error(`getPlatformConfig failed: ${r.code} ${r.msg}`);
  const data = (r.obj && r.obj.data) || {};
  // key 100000013 对应 decr_config_key（AES-128-ECB 解密其他配置的密钥）
  const cp = data['10000'] || {};
  const decrConfigKey = cp['100000013'] || null;
  return { rawConfig: data, decrConfigKey };
}

/**
 * 获取账号完整信息（含公司列表 + 完整 user_info + 最新 jwttoken）
 * 路由：usergroup/account/upgrade（真调验证 2026-07-14）
 * 基本等价于登录后的"refresh全量"——返回最新 jwttoken 和完整用户信息。
 * @returns {Promise<{accessToken,userInfo,accountInfo,companyList}>}
 */
async function getAccountInfo() {
  const r = await get('usergroup/account/upgrade');
  if (r.code !== 200) throw new Error(`getAccountInfo failed: ${r.code} ${r.msg}`);
  const o = r.obj || {};
  return {
    accessToken: o.access_token,
    userInfo:    o.user_info,
    accountInfo: o.account_info,
    companyList: o.company_list || [],
    raw: o,
  };
}

/**
 * 获取用户个人配置（偏好设置、AI助手配置、搜索布局等）
 * 路由：94capi/platform/user/config/get（真调验证 2026-07-14）
 * 含 interlloft(AI机器人)、search_first_tab_conf(搜索tab)、
 *   record_switch、meeting_notice_switch 等个人偏好。
 * @returns {Promise<object>} 完整配置 obj
 */
async function getUserConfig() {
  const r = await get('94capi/platform/user/config/get', {});
  if (r.code !== 200) throw new Error(`getUserConfig failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取企业价值观标签列表（名片标签、OKR 标签用）
 * 路由：94capi/cnf/statics/valuestag（真调验证 2026-07-14）
 * 返回 default_tag_name + values_list[{tag_id,tag_name,tag_name_en,sort}]
 * @returns {Promise<{defaultTagName:string, tags:Array}>}
 */
async function getValueTags() {
  const r = await get('94capi/cnf/statics/valuestag', {});
  if (r.code !== 200) throw new Error(`getValueTags failed: ${r.code} ${r.msg}`);
  const o = r.obj || {};
  return {
    defaultTagName: o.default_tag_name || '',
    tags: (o.values_list || []).map(t => ({
      id:     t.tag_id,
      name:   t.tag_name,
      nameEn: t.tag_name_en,
      sort:   t.sort,
    })),
  };
}

/**
 * 查询未来人（Young）新帖数量
 * 路由：y/young/newPost（真调验证 2026-07-14）
 * @returns {Promise<{newPostCount:number}>}
 */
async function getYoungNewPost() {
  const r = await get('y/young/newPost', {});
  if (Number(r.code) !== 200) throw new Error(`getYoungNewPost failed: ${r.code} ${r.msg}`);
  const d = r.data || {};
  return { newPostCount: Number(d.new_post_count) || 0 };
}

/**
 * 获取工作状态详情（含自动回复内容）
 * 路由：POST bsvr/workstate/info {wuc_id}
 * ⭐ 真调验证 2026-07-21：返回完整状态信息
 *   字段：wuc_id, uid, info_id, auto_reply, auto_reply_id,
 *         start_time, end_time, continue, time_diff_str,
 *         emoji, content, custom, replyInfo, auto_reply_info[],
 *         wuc_type, remark
 * @param {string} wucId 工作状态 id（从 listWorkstates 的 id 字段获取）
 */
async function getWorkstateInfo(wucId) {
  if (!wucId) throw new Error('[ch9:getWorkstateInfo] 需传 wucId');
  const r = await post('bsvr/workstate/info', { wuc_id: String(wucId) });
  if (r.code !== 200) throw new Error(`getWorkstateInfo failed: ${r.code} ${r.msg}`);
  return r.obj;
}
