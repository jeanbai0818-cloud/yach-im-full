/**
 * 第六章：全局搜索
 * 前缀 95search（search.js 逆向还原 + 实测，2026-07-12）
 * 已真调验证：
 *   searchUser  ✅ /search/usersearch
 *   searchAll   ✅ /search/allsearch（综合：recommend/person/application/group）
 *   searchGroup ✅ /search/v2/gpsearch
 *   searchDoc   ✅ /knowledge/search（知识库/文档节点，非 docsearch）
 *   searchAssistantHistory ✅ /search/aide（助手历史）
 * ⭐ 重要真相：95search **无** docsearch/msgsearch 路由（之前为猪猜，报 400）。
 *   文档搜索走 knowledge/search；消息搜索 95search 不提供（本地库已有 searchMessage 工具）。
 */
const { post } = require('../../utils/request');

async function _search(path, querystr, opts = {}) {
  const r = await post(path, {
    querystr,
    page:     opts.page     ?? 1,
    pagesize: opts.pagesize ?? 20,
    ...opts.extra,
  });
  if (r.code !== 200) throw new Error(`search failed [${path}]: ${r.code} ${r.msg}`);
  return r.obj;
}

/** 搜索用户 */
const searchUser  = (q, opts) => _search('95search/search/usersearch', q, { ...opts, extra: { on_job: 1, ...(opts?.extra||{}) } });
/** 全局综合搜索 */
const searchAll   = (q, opts) => _search('95search/search/allsearch', q, opts);
/** 搜索群组 */
const searchGroup = (q, opts) => _search('95search/search/v2/gpsearch', q, opts);
/** 搜索文档/知识库（真实路由 knowledge/search，非 docsearch）*/
const searchDoc   = (q, opts) => _search('95search/knowledge/search', q, opts);
/** 搜索助手历史（search/aide）*/
const searchAssistantHistory = (q, opts) => _search('95search/search/aide', q, opts);

/**
 * @提醒用户校验（验证某用户是否可被 @）
 * 路由：remind/user/list（609usergroup.js: remindUserList；CAPABILITY: bsvr/remind/user/check）
 */
async function checkRemindUsers(accids = []) {
  const r = await post('bsvr/remind/user/list', { accids: JSON.stringify(accids) });
  if (r.code !== 200) throw new Error(`checkRemindUsers failed: ${r.code} ${r.msg}`);
  return r.obj;
}

/**
 * 直播列表（当前/历史）
 * 路由：zb/capi/lives 和 zb/capi/lives/history
 * 字段：id/title/creator_name/speaker_name/status/started_at/replay/play_time
 * status: 0=未开始 1=直播中 2=已结束 3=已结束(历史)
 */
async function listLives({ page = 1, history = false } = {}) {
  const { get } = require('../../utils/request');
  const path = history ? 'zb/capi/lives/history' : 'zb/capi/lives';
  const r = await get(path, { page });
  if (!r || (r.code !== undefined && r.code !== 200)) {
    throw new Error(`listLives failed: ${r?.code} ${r?.msg || r?.message}`);
  }
  // zb 接口返回格式与 capi 不同：{ msg:'Success', data: { data:[], current_page, last_page, per_page } }
  const data = r.data ?? r.obj ?? {};
  return {
    currentPage: data.current_page ?? page,
    lastPage: data.last_page ?? 1,
    total: data.total ?? (data.data?.length ?? 0),
    items: (data.data ?? []).map(item => ({
      id: item.id,
      title: item.title,
      status: item.status,            // 0=未开始 1=直播中 2=已结束 3=历史已结束
      creatorName: item.creator_name,
      speakerName: item.speaker_name,
      speakerAvatar: item.speaker_avatar,
      startedAt: item.started_at,
      endedAt: item.ended_at,
      actualStartedAt: item.actual_started_at,
      actualEndedAt: item.actual_ended_at,
      playTime: item.play_time,       // 秒数
      replayUrl: item.replay ?? null, // 历史直播回放 URL
      replayEnabled: item.replay_switch === 1,
      type: item.type,
    })),
  };
}

module.exports = { searchUser, searchAll, searchGroup, searchDoc, searchAssistantHistory, checkRemindUsers, listLives };
