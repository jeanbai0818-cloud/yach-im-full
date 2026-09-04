/**
 * 第三章：AI 能力（知音楼内置 AI 机器人）
 * 前缀 94capi
 *
 * 逆向来源：share/config/config-url/capi.js
 *   'airobotList':        prefix + '/airobot/robot/list'    列出可用 AI 机器人
 *   'airobotPromptShare': prefix + '/airobot/prompt/share'  分享/获取 prompt 模板
 *
 * 说明：
 *   - 这是知音楼 App 内的 AI 助手/机器人管理接口，与 IM(NIM) 无关。
 *   - 与 robot 通信(/robot/message，webhook 推送)也不同，别混用。
 *   - 只读列表类接口，安全。
 */
const { post, get } = require('../../utils/request');

/**
 * 列出当前可用的 AI 机器人/智能助手。
 * 路由：93client/smart/assistant/list（真调验证 2026-07-21，code=200）
 * 返回 created_and_concern（我创建+关注，最多120）+ hot（热门20）
 * 字段：name/robot_desc/robot_uid/robot_app_id/is_follow/robot_icon_small/developer
 * @returns {Promise<{createdAndConcern:Array, hot:Array}>} 机器人列表
 */
async function listRobots(opts = {}) {
  const { get } = require('../../utils/request');
  const r = await get('93client/smart/assistant/list', {});
  if (r.code !== 200) throw new Error(`listRobots failed: ${r.code} ${r.msg}`);
  const d = r.obj || {};
  const limit = opts.pagesize ?? opts.limit ?? 50;
  const all = [...(d.created_and_concern || []), ...(d.hot || [])];
  // 去重（robot_uid）
  const seen = new Set();
  const unique = all.filter(item => {
    const key = item.robot_uid || item.robot_app_id || item.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    createdAndConcern: (d.created_and_concern || []).slice(0, limit),
    hot:               (d.hot || []).slice(0, 20),
    total:             unique.length,
    raw:               d,
  };
}

/**
 * 搜索全公司智能助手（93client/smart/assistant/search）
 * 真调验证 2026-07-21，code=200，返回 total+list
 * @param {string} keyword 关键词
 * @param {object} opts { page, pagesize }
 */
async function searchAssistants(keyword, opts = {}) {
  const { get } = require('../../utils/request');
  const r = await get('93client/smart/assistant/search', {
    keyword: keyword || '',
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`searchAssistants failed: ${r.code} ${r.msg}`);
  return r.obj || {};
}

/**
 * 获取/分享 AI prompt 模板。
 * @param {object} opts 透传参数（如 promptId 等，取决于场景）
 */
async function sharePrompt(opts = {}) {
  const r = await post('94capi/airobot/prompt/share', { ...opts });
  if (r.code !== 200) throw new Error(`airobot prompt share failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 列出某个 AI 机器人的 prompt 模板（提示词）
 * ⭐ 真路由：GET 619_api/airobot/prompt/list?robot_id=xxx
 *   关键：619_api 走 stream 域名（yach-stream.zhiyinlou.com），不是 capi！
 *   之前用 capi 域名一直 401/10011；域名改对后 code=200（2026-07-21 验证）。
 *   返回 {list:[...], max_count}。
 * @param {string|number} robotId 机器人 id（必传，从 listRobots 拿）
 */
async function listPrompts(robotId, opts = {}) {
  if (robotId === undefined || robotId === null || robotId === '') {
    throw new Error('[ch3:listPrompts] 需传 robotId（从 yach_list_ai_robots 的 robot_id 拿）');
  }
  const r = await get('619_api/airobot/prompt/list', { robot_id: String(robotId) });
  if (r.code !== 200) throw new Error(`[ch3:listPrompts] failed: ${r.code} ${r.msg}`);
  return r.obj || { list: [], max_count: 0 };
}

/**
 * 收藏/取消收藏 prompt
 * 路由：airobot/prompt/collect（robotPromptCollect）
 */
/**
 * 收藏/取消 prompt（619_api 真调通）
 * 参数来自源码: {prompt_id, type, content, title}
 * type: 似乎是操作类型（实测 type 任意值均 200，包括空）
 */
async function collectPrompt(opts = {}) {
  const r = await post('619_api/airobot/prompt/collect', {
    prompt_id: String(opts.promptId || opts.prompt_id || ''),
    type: opts.type ?? 2,
    content: opts.content || '',
    title: opts.title || '',
  });
  if (r.code !== 200) throw new Error(`collect prompt failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取 prompt 详情
 * 路由: GET 619_api/airobot/prompt/detail?id=xxx
 * 返回 prompt 完整内容（id, title, content, open, ...）
 */
async function getPromptDetail(promptId) {
  if (!promptId) throw new Error('[ch3:getPromptDetail] 需传 promptId');
  const r = await get('619_api/airobot/prompt/detail', { id: String(promptId) });
  if (r.code !== 200) throw new Error(`get prompt detail failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 新建 prompt
 * 路由: POST 619_api/airobot/prompt/add
 * 参数: {robot_id, title, content, open(0私有/1公开)}
 */
async function addPrompt(opts = {}) {
  if (!opts.robotId && !opts.robot_id) throw new Error('[ch3:addPrompt] 需传 robotId');
  const r = await post('619_api/airobot/prompt/add', {
    robot_id: String(opts.robotId || opts.robot_id),
    title: opts.title || '',
    content: opts.content || '',
    open: opts.open ?? 0,
  });
  if (r.code !== 200) throw new Error(`add prompt failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除 prompt
 * 路由: POST 619_api/airobot/prompt/del
 * 参数: {id}
 */
async function delPrompt(promptId) {
  if (!promptId) throw new Error('[ch3:delPrompt] 需传 promptId');
  const r = await post('619_api/airobot/prompt/del', { id: String(promptId) });
  if (r.code !== 200) throw new Error(`del prompt failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 编辑 prompt
 * 路由: POST 619_api/airobot/prompt/edit
 * 参数: {id, title, content, open(0私有/1公开)}
 */
async function editPrompt(opts = {}) {
  if (!opts.id && !opts.promptId) throw new Error('[ch3:editPrompt] 需传 id');
  const r = await post('619_api/airobot/prompt/edit', {
    id: String(opts.id || opts.promptId),
    title: opts.title || '',
    content: opts.content || '',
    open: opts.open ?? 0,
  });
  if (r.code !== 200) throw new Error(`edit prompt failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 调整 prompt 排序
 * 路由: POST 619_api/airobot/prompt/order
 * 参数: {id, pos(1-based), robot_id}
 */
async function orderPrompt(opts = {}) {
  const r = await post('619_api/airobot/prompt/order', {
    id: String(opts.id || opts.promptId),
    pos: opts.pos ?? 1,
    robot_id: String(opts.robotId || opts.robot_id || ''),
  });
  if (r.code !== 200) throw new Error(`order prompt failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 获取负反馈标签列表（评价 AI 回答时用）
 * 路由: GET 619_api/tag/list?source=0
 * 返回 [{id, name, name_en, type}, ...]
 */
async function getDownvoteTagList(source = 0) {
  const r = await get('619_api/tag/list', { source });
  if (r.code !== 200) throw new Error(`get downvote tag list failed: ${r.code} ${r.msg}`);
  return r.obj || [];
}

/**
 * 搜索 AI 助手历史
 * ⭐ 真实路由 = `95search/search/aide`（search.js: searchAssistantHistory=prefix+'/search/aide'，prefix=95search）
 *   之前误用 94capi/search/aide 报 10011；实测 95search 前缀 code=200。
 *   返回结构：{ total, total_page, size, lists:[...] }
 */
async function searchAssistantHistory(querystr, opts = {}) {
  const r = await post('95search/search/aide', {
    querystr, page: opts.page ?? 1, pagesize: opts.pagesize ?? 20,
  });
  if (r.code !== 200) throw new Error(`search assistant history failed: ${r.code} ${r.msg}`);
  return r.obj;
}


/**
 * 列出系统内置 aide/bot 助手（bsvr/aide/user/list）
 * 返回 [{id, name, pic, sign, user_type_sub}]
 */
async function listAideBots(opts = {}) {
  const { page = 1, size = 100 } = opts;
  const r = await post('bsvr/aide/user/list', { page, size });
  if (r.code !== 200) throw new Error(`listAideBots failed: ${r.code} ${r.msg}`);
  return { list: r.obj || [], total: (r.obj || []).length };
}

/**
 * 获取单个 aide 助手详情（bsvr/aide/detail）
 * aideId: 助手 id（如 3002=文件小助手）
 */
async function getAideDetail(aideId) {
  const r = await post('bsvr/aide/detail', { aide_id: String(aideId) });
  if (r.code !== 200) throw new Error(`getAideDetail failed: ${r.code} ${r.msg}`);
  return r.obj;
}

module.exports = { listRobots, sharePrompt, listPrompts, collectPrompt, getPromptDetail, addPrompt, delPrompt, editPrompt, orderPrompt, getDownvoteTagList, searchAssistantHistory, searchAssistants, listAideBots, getAideDetail, checkRobotName, createAgentRobot, deleteAgentRobot };

// ==============================
// 自定义 AI 机器人管理（93client/airobot/*）
// ==============================

/**
 * 检查机器人名称是否可用
 * 路由: POST 93client/airobot/name/check
 * 返回: 200=可用；70000005=名称已被使用
 */
async function checkRobotName(name) {
  const r = await post('93client/airobot/name/check', { name });
  if (r.code === 200) return { available: true };
  if (r.code === 70000005) return { available: false, msg: r.msg };
  throw new Error(`checkRobotName failed: ${r.code} ${r.msg}`);
}

/**
 * 创建自定义 AI 机器人
 * 路由: POST 93client/airobot/add
 * 参数: {name, desc, model_id, avatar(可选)}
 * model_id: 1=默认模型（测试验证可用）
 * 返回: {id, name, uuid}
 */
async function createAgentRobot(opts = {}) {
  if (!opts.name) throw new Error('[ch3:createAgentRobot] 需传 name');
  const r = await post('93client/airobot/add', {
    name: opts.name,
    desc: opts.desc || '',
    model_id: String(opts.model_id ?? 1),
    ...(opts.avatar ? { avatar: opts.avatar } : {}),
  });
  if (r.code !== 200) throw new Error(`createAgentRobot failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 删除自定义 AI 机器人
 * 路由: POST 93client/airobot/del
 * 参数: {id}（机器人 id，来自 createAgentRobot 或 listRobots）
 */
async function deleteAgentRobot(robotId) {
  if (!robotId) throw new Error('[ch3:deleteAgentRobot] 需传 robotId');
  const r = await post('93client/airobot/del', { id: String(robotId) });
  if (r.code !== 200) throw new Error(`deleteAgentRobot failed: ${r.code} ${r.msg}`);
  return r.obj;
}
