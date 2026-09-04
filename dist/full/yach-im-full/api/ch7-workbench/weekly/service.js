/**
 * 周报业务编排：模板 / 已发送列表 / 详情 / 收藏 / 读者
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 weekly/service.js，改写为 CJS。
 * 周报正文 content/content_full 是 JSON 字符串数组，每段 {title, content, okrTitle...}。
 */
'use strict';

const crypto = require('node:crypto');
const client = require('./client');
const WEEKLY_SEND_TOKEN_TTL_MS = 10 * 60 * 1000;
const weeklySendPreparations = new Map();
const weeklySendFingerprints = new Map();

function ensureRecord(v) {
  if (typeof v === 'string') {
    const text = v.trim();
    if (!text) return {};
    try { v = JSON.parse(text); } catch { return {}; }
  }
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function readJsonArray(value) {
  if (Array.isArray(value)) return value.filter((x) => x && typeof x === 'object');
  const text = String(value || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed.filter((x) => x && typeof x === 'object') : [];
  } catch {
    return [];
  }
}
function tsToStr(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

/** 剥 HTML 标签为纯文本 */
function stripHtml(s) {
  return String(s || '')
    .replace(/<img[^>]*>/gi, '[图片]')
    .replace(/<\/(p|div|br|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\n/g, '<br>');
}

function cloneSections(value) {
  return readJsonArray(value).map((section) => ({ ...section }));
}

function computeDraftRevision(draft) {
  const value = ensureRecord(draft);
  const stable = JSON.stringify({
    templateType: String(value.template_type || ''),
    updatedAt: value.update_at ?? null,
    content: typeof value.content === 'string' ? value.content : JSON.stringify(value.content || []),
    contentFull: typeof value.content_full === 'string' ? value.content_full : JSON.stringify(value.content_full || []),
  });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 24);
}

function isNoProgressPlaceholder(value) {
  const text = stripHtml(String(value || '')).replace(/\s+/g, '');
  if (!text || text.length > 80) return false;
  return /无(?:直接)?进展|暂无(?:进展|计划|内容)?|没有(?:进展|计划|内容)|待规划|后续再规划|本周无|下周无/.test(text);
}

const CANONICAL_NON_OKR_TITLES = new Set([
  '本周完成_1-1',
  '下周计划_0-1',
  '用户心声',
  '心得',
  '心得（好的经验分享给别人）',
  '反思',
  '反思（觉察到自己的问题）',
  '备注',
]);

const REQUIRED_NON_OKR_SECTIONS = [
  { title: '本周完成_1-1', aliases: ['本周完成_1-1'] },
  { title: '下周计划_0-1', aliases: ['下周计划_0-1'] },
  { title: '用户心声', aliases: ['用户心声'] },
  { title: '心得（好的经验分享给别人）', aliases: ['心得（好的经验分享给别人）', '心得'] },
  { title: '反思（觉察到自己的问题）', aliases: ['反思（觉察到自己的问题）', '反思'] },
  { title: '备注', aliases: ['备注'] },
];

function ensureRequiredNonOkrSections(content, contentFull) {
  for (const required of REQUIRED_NON_OKR_SECTIONS) {
    const matches = (section) => required.aliases.includes(String(section?.title || ''));
    let plain = content.find(matches);
    let full = contentFull.find(matches);
    if (!plain && !full) {
      plain = { title: required.title, content: '', isHi: false, isDel: false, count_word: 0 };
      full = { ...plain };
      content.push(plain);
      contentFull.push(full);
    } else if (plain && !full) {
      full = { ...plain };
      contentFull.push(full);
    } else if (!plain && full) {
      plain = { ...full, content: stripHtml(full.content) };
      content.push(plain);
    }
  }
  return { content, contentFull };
}

function isKrSection(section) {
  return Number(section?.oId) > 0 && Number(section?.krId) > 0;
}

function sectionPeriod(section) {
  const title = String(section?.title || '');
  if (title.startsWith('本周完成_')) return 'current';
  if (title.startsWith('下周计划_')) return 'next';
  return '';
}

function makeKrSection(objective, kr, period, full = false) {
  const current = period === 'current';
  return {
    title: `${current ? '本周完成_1' : '下周计划_0'}${kr.id}`,
    content: '',
    oId: objective.id,
    krId: kr.id,
    okrTitle: kr.okrTitle,
    // 知音楼周报前端用 isHi 表示该 KR 是否隐藏：
    // false=已勾选并显示，true=未勾选。完整框架中补出的 KR 不能擅自勾选。
    isHi: true,
    isDel: false,
    count_word: 0,
    ...(full ? {} : {}),
  };
}

function syncOkrSections(contentValue, fullValue, structure) {
  const content = cloneSections(contentValue);
  const full = cloneSections(fullValue);
  const currentKrIds = new Set();

  const syncOne = (sections, isFull) => {
    const existing = new Map();
    const nonKr = [];
    const stale = [];
    for (const section of sections) {
      if (!isKrSection(section)) {
        nonKr.push(section);
        continue;
      }
      const key = `${Number(section.krId)}:${sectionPeriod(section)}`;
      existing.set(key, section);
    }
    const synced = [];
    for (const objective of structure.objectives) {
      for (const kr of objective.krs) {
        currentKrIds.add(String(kr.id));
        for (const period of ['current', 'next']) {
          const key = `${Number(kr.id)}:${period}`;
          const section = existing.get(key) || makeKrSection(objective, kr, period, isFull);
          synced.push({
            ...section,
            oId: objective.id,
            krId: kr.id,
            okrTitle: kr.okrTitle,
          });
          existing.delete(key);
        }
      }
    }
    stale.push(...existing.values());
    const leading = nonKr.filter((section) => /^(本周完成_1-1|下周计划_0-1)$/.test(String(section.title || '')));
    const trailing = nonKr.filter((section) => !leading.includes(section));
    return { sections: [...leading, ...synced, ...stale, ...trailing], stale };
  };

  const contentSync = syncOne(content, false);
  const fullSync = syncOne(full, true);
  return {
    content: contentSync.sections,
    contentFull: fullSync.sections,
    staleKrIds: [...new Set([...contentSync.stale, ...fullSync.stale].map((s) => String(s.krId)))],
    currentKrIds: [...currentKrIds],
  };
}

function applySectionUpdates(content, contentFull, updates) {
  const applied = [];
  for (const rawUpdate of asArray(updates)) {
    const update = ensureRecord(rawUpdate);
    const period = update.period === 'next' ? 'next' : 'current';
    const matches = (section) => {
      if (update.title) return String(section.title) === String(update.title);
      return String(section.krId) === String(update.krId) && sectionPeriod(section) === period;
    };
    let plainSection = content.find(matches);
    let fullSection = contentFull.find(matches);
    if (!plainSection && !fullSection && update.title && CANONICAL_NON_OKR_TITLES.has(String(update.title))) {
      plainSection = { title: String(update.title), content: '', isHi: false, isDel: false, count_word: 0 };
      fullSection = { ...plainSection };
      content.push(plainSection);
      contentFull.push(fullSection);
    } else if (plainSection && !fullSection) {
      fullSection = { ...plainSection };
      contentFull.push(fullSection);
    } else if (!plainSection && fullSection) {
      plainSection = { ...fullSection, content: stripHtml(fullSection.content) };
      content.push(plainSection);
    }
    if (!plainSection || !fullSection) {
      throw new Error(`找不到周报段落：${update.title || `krId=${update.krId}, period=${period}`}`);
    }
    const plainText = String(update.content ?? '');
    if (isNoProgressPlaceholder(plainText)) {
      throw new Error(
        `段落 ${update.title || `krId=${update.krId}, period=${period}`} 使用了“无进展/待规划”占位内容。` +
        '没有可验证进展时请省略该 sectionUpdate；需要删除旧内容时明确传 content=""。',
      );
    }
    plainSection.content = plainText;
    plainSection.count_word = plainText.length;
    fullSection.content = update.contentFull !== undefined
      ? String(update.contentFull)
      : `<p>${escapeHtml(plainText)}</p>`;
    fullSection.count_word = plainText.length;
    let krSelected = null;
    if (isKrSection(plainSection)) {
      // KR 的勾选状态按 KR 成对生效，本周/下周必须一致。写入非空进展时默认勾选；
      // 清空正文不自动取消勾选，只有 includeKr=false 才显式隐藏整个 KR。
      krSelected = update.includeKr === false ? false : (update.includeKr === true || plainText.trim() ? true : !plainSection.isHi);
      for (const section of [...content, ...contentFull]) {
        if (String(section.krId) === String(plainSection.krId)) section.isHi = !krSelected;
      }
    }
    applied.push({
      title: String(plainSection.title),
      content: plainText,
      ...(krSelected == null ? {} : { krId: String(plainSection.krId), krSelected }),
    });
  }
  return applied;
}

/** 归一化周报正文分段 */
function normalizeSections(raw) {
  return readJsonArray(raw).map((s) => ({
    title: String(s.title || '').trim(),
    content: stripHtml(s.content),
    okrTitle: s.okrTitle ? stripHtml(s.okrTitle) : '',
    krId: s.krId || s.kr_id || null,
  }));
}

// 抓包确认（mgo/log/template）：2=普通周报 3=OKR周报 6=复盘周报；1/4 为早期推测
const TEMPLATE_TYPE_NAME = { 1: '日报', 2: '周报', 3: 'OKR周报', 4: '月报', 6: '复盘周报' };

/** 归一化一条周报（列表项 / 详情通用）*/
function normalizeWeekly(raw) {
  const o = ensureRecord(raw);
  const id = o._id && typeof o._id === 'object' ? o._id.$oid : o._id;
  const sections = normalizeSections(o.content_full || o.content);
  const readList = asArray(o.read_list);
  const zanList = asArray(o.zan_list);
  return {
    logId: String(id || ''),
    templateType: String(o.template_type || ''),
    templateName: TEMPLATE_TYPE_NAME[Number(o.template_type)] || '周报',
    senderName: String(o.send_user_name || ''),
    senderWorkCode: String(o.send_user_work_code || ''),
    weekStart: tsToStr(o.this_week_start_time),
    nextWeekStart: tsToStr(o.next_week_start_time),
    createdAt: tsToStr(o.create_at),
    sections,
    readCount: Number(o.read_list_count ?? readList.length) || 0,
    starCount: Number(o.zan_list_count ?? zanList.length) || 0,
    isRead: o.is_read === '1' || o.is_read === 1,
  };
}

// ── 只读能力 ────────────────────────────────────────────────

async function listWeeklyTemplates() {
  const obj = ensureRecord(await client.readTemplates());
  const list = asArray(obj.list).map((t) => ({
    id: t._id && typeof t._id === 'object' ? t._id.$oid : t._id,
    title: String(t.template_title || ''),
    type: String(t.type || t.template_type || ''),
    sections: asArray(t.template_content).map((s) => ({ title: String(s.title || ''), placeholder: String(s.content || '') })),
  }));
  // selected = 当前选中的模板类型（桌面端默认）；2=普通 3=OKR 6=复盘
  return { selected: obj.selected != null ? String(obj.selected) : '', list };
}

/**
 * ⭐ 读当前周报草稿（指定模板类型）—— mgo/log/draft/get，真调验证 2026-07-13。
 * 返回桌面端「写周报」页面当前草稿的全部字段（content/content_full 已解析为数组），
 * 方便 Agent 拿到现有段落结构（type=3 带 oId/krId/okrTitle）后修改再回存。
 * templateType=3 时会只读拉取当前季度 OKR，并把草稿未返回的空 KR 段补入结果。
 * 周报草稿只是已写内容快照，不能单独作为完整 OKR 结构。
 */
async function getWeeklyDraft(templateType) {
  const o = ensureRecord(await client.readDraft(templateType));
  const effectiveTemplateType = String(o.template_type || templateType || '');
  let content = cloneSections(o.content);
  let contentFull = cloneSections(o.content_full);
  let okrStructureSynced = false;
  let addedKrIds = [];
  let currentKrIds = [];
  let staleKrIds = [];
  let objectiveCount = 0;
  let krCount = 0;
  let selectedKrIds = [];
  let hiddenKrIds = [];

  if (effectiveTemplateType === '3') {
    let structure;
    try {
      structure = await require('../okr/service').getCurrentOkrStructure();
    } catch (error) {
      throw new Error(
        `无法取得完整的当前季度 OKR/KR 结构，未把不完整草稿返回为完整框架：${error.message}`,
      );
    }
    const draftKrIds = new Set(content.filter(isKrSection).map((section) => String(section.krId)));
    const syncResult = syncOkrSections(content, contentFull, structure);
    content = syncResult.content;
    contentFull = syncResult.contentFull;
    addedKrIds = syncResult.currentKrIds.filter((krId) => !draftKrIds.has(String(krId)));
    currentKrIds = syncResult.currentKrIds.map(String);
    staleKrIds = syncResult.staleKrIds.map(String);
    objectiveCount = structure.objectives.length;
    krCount = syncResult.currentKrIds.length;
    okrStructureSynced = true;
    const visibility = new Map();
    for (const section of content.filter(isKrSection)) {
      const krId = String(section.krId);
      if (!currentKrIds.includes(krId)) continue;
      const selected = section.isHi !== true;
      visibility.set(krId, (visibility.get(krId) || false) || selected);
    }
    selectedKrIds = currentKrIds.filter((krId) => visibility.get(krId) === true);
    hiddenKrIds = currentKrIds.filter((krId) => visibility.get(krId) !== true);
  }
  ensureRequiredNonOkrSections(content, contentFull);

  const currentKrIdSet = new Set(currentKrIds);
  const staleKrIdSet = new Set(staleKrIds);
  const parseSegs = (v) => {
    const arr = readJsonArray(v);
    return arr.map((s) => ({
      title: String(s.title || ''),
      content: String(s.content || ''),
      oId: s.oId != null ? s.oId : null,
      krId: s.krId != null ? s.krId : null,
      okrTitle: s.okrTitle ? stripHtml(String(s.okrTitle)) : '',
      isHi: !!s.isHi,
      selectedInWeekly: isKrSection(s) ? s.isHi !== true : null,
      countWord: Number(s.count_word) || 0,
      okrStatus: isKrSection(s)
        ? (currentKrIdSet.has(String(s.krId)) ? 'current' : (staleKrIdSet.has(String(s.krId)) ? 'stale' : 'unknown'))
        : 'non_okr',
    }));
  };
  return {
    logId: String((o._id && typeof o._id === 'object' ? o._id.$oid : o._id) || ''),
    templateType: effectiveTemplateType,
    templateName: TEMPLATE_TYPE_NAME[Number(o.template_type)] || '周报',
    isShare: o.is_share === 1 || o.is_share === '1',
    isSendReportUser: o.is_send_report_user === 1 || o.is_send_report_user === '1',
    sections: parseSegs(content),
    okrStructureSynced,
    objectiveCount,
    krCount,
    currentKrSectionCount: content.filter((section) => isKrSection(section) && currentKrIdSet.has(String(section.krId))).length,
    nonOkrSectionCount: content.filter((section) => !isKrSection(section)).length,
    addedKrIds,
    selectedKrIds,
    hiddenKrIds,
    selectedKrCount: selectedKrIds.length,
    hiddenKrCount: hiddenKrIds.length,
    staleKrIds,
    receiveUserIds: asArray(o.receive_user_ids).map(String),
    receiveGroupIds: asArray(o.yach_receive_group_ids).map(String),
    notifyUserIds: asArray(o.notify_user_ids).map(String),
    weekStart: tsToStr(o.this_week_start_time),
    nextWeekStart: tsToStr(o.next_week_start_time),
    updatedAt: tsToStr(o.update_at),
    draftRevision: computeDraftRevision(o),
    // 原始 content/content_full 字符串——回存时可直接复用/修改（避免丢字段）
    rawContent: JSON.stringify(content),
    rawContentFull: JSON.stringify(contentFull),
  };
}

/**
 * 我发出的周报列表。
 * ⚠️ 服务端实测：mgo/log/send/list 忽略 page/limit/任何游标参数，
 *    固定只返回最近约 10 篇（按创建时间倒序），无翻页能力。
 *    更早的历史周报（及“看他人周报”）只在 web 应用（okr.zhiyinlou.com）里，桌面端协议无此接口。
 */
async function listSentWeekly() {
  const obj = ensureRecord(await client.readSentList(1, 50));
  const list = asArray(obj.list).map(normalizeWeekly);
  return {
    returned: list.length,
    note: '服务端只返回最近约 10 篇，不支持翻页。',
    list,
  };
}

/**
 * ⭐ 我接收的周报（他人发给我的）—— 真调验证 2026-07-13
 * mgo/log/receive/all，走同一套 capi 签名（从 weekly-pc 前端 bundle 逆出）。
 * ⚠️ 同 send/list 服务端硬固定返回最近 ~10 篇，忽略 page/limit。
 * 返回的 logId 可直接用于 getWeeklyDetail / zanWeekly（给他人周报点赞）。
 * 发报人字段与 send/list 不同（这里是 send_user_id/send_from，无 send_user_name），需用 yach_search_users 反查姓名。
 */
async function listReceivedWeekly() {
  const obj = ensureRecord(await client.readReceivedList(1, 50));
  const list = asArray(obj.list).map((raw) => {
    const w = normalizeWeekly(raw);
    w.senderUserId = String(raw.send_user_id || '');
    w.sendFrom = String(raw.send_from || '');
    return w;
  });
  return {
    returned: list.length,
    note: '服务端只返回最近约 10 篇，不支持翻页。发报人仅 send_user_id，需 yach_search_users 反查姓名。',
    list,
  };
}

/**
 * ⭐ 我的周报收到的互动动态（谁给我点赞/评论了）—— 真调验证 2026-07-13
 * mgo/log/event/list。action_type：2=点赞、1=评论、4=其他。服务端一次全返，忽略 page/limit。
 */
async function listWeeklyEvents() {
  const obj = ensureRecord(await client.readEventList(1, 200));
  const TYPE = { 1: '评论', 2: '点赞', 4: '其他' };
  const list = asArray(obj.list).map((e) => ({
    actionType: Number(e.action_type) || 0,
    action: TYPE[Number(e.action_type)] || String(e.action_content || ''),
    actor: String(e.user_name || ''),
    actorId: String(e.user_id || ''),
    at: String(e.action_date || tsToStr(e.log_cdate)),
    logId: String(e.log_id || ''),
    logAuthor: String(e.log_user_name || ''),
    summary: stripHtml(String(e.log_content || '')).replace(/\s+/g, ' ').trim().slice(0, 50),
  }));
  return { returned: list.length, note: '服务端一次全返，不支持翻页。', list };
}

/** 周报周期列表（选“看哪一周”用） */
async function listWeeklyWeeks() {
  const obj = ensureRecord(await client.readWeeks());
  return asArray(obj.list).map((w) => ({
    start: tsToStr(w.start_time),
    end: tsToStr(w.end_time),
    startTs: Number(w.start_time) || 0,
    endTs: Number(w.end_time) || 0,
  }));
}

/** 我收藏（星标）的周报列表 */
async function listStarWeekly(page = 1, limit = 20) {
  const obj = ensureRecord(await client.readStarList(page, Math.min(Math.max(limit, 1), 50)));
  return {
    total: Number(obj.total || 0),
    page,
    list: asArray(obj.list).map(normalizeWeekly),
  };
}

/**
 * 周报详情。
 * ⚠️ detail/get 的 read_list / zan_list 曾出现服务端 id/name 映射不一致，不能据此猜测用户身份。
 *    因此点赞人/已读人优先从 send/list 里这篇的记录取（那里准），detail 只用来取正文；send/list 拿不到（超出最近10篇）时才回退用 detail 的脏数据。
 */
async function getWeeklyDetail(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const obj = await client.readDetail(logId);
  const normalized = normalizeWeekly(obj);
  const o = ensureRecord(obj);
  // 从 send/list 交叉拿准确的 zan_list/read_list（规避 detail 脸名 bug）
  let authZan = null, authRead = null, fromSendList = false;
  try {
    const sl = ensureRecord(await client.readSentList(1, 50));
    const hit = asArray(sl.list).find((w) => String(w._id) === String(logId));
    if (hit) {
      fromSendList = true;
      authZan = asArray(hit.zan_list);
      authRead = asArray(hit.read_list);
    }
  } catch (_) { /* send/list 失败时回退 detail */ }
  const zanSrc = authZan || asArray(o.zan_list);
  const readSrc = authRead || asArray(o.read_list);
  return {
    ...normalized,
    receiveUsers: asArray(o.default_receive_user_info || o.receive_user_info).map((u) => String(u.name || u.user_name || '')).filter(Boolean),
    readers: readSrc.map((u) => String(u.name || u.user_name || '')).filter(Boolean),
    readerIds: readSrc.map((u) => String(u.id || u.user_id || '')).filter(Boolean),
    starUsers: zanSrc.map((u) => String(u.name || u.user_name || '')).filter(Boolean),
    starUserIds: zanSrc.map((u) => String(u.id || u.user_id || '')).filter(Boolean),
    // true=名单来自准确的 send/list；false=回退用了 detail（名字可能不准）
    _peopleFromSendList: fromSendList,
    remarks: asArray(o.remark_list).map((r) => ({
      user: String(r.user_name || r.name || ''),
      content: String(r.content || r.remark || ''),
      at: tsToStr(r.create_at || r.ctime),
    })),
  };
}

/** 谁读过这篇周报 */
async function getWeeklyReaders(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const obj = ensureRecord(await client.readReaders(logId));
  return asArray(obj.list || obj.read_list).map((u) => ({
    name: String(u.name || u.user_name || ''),
    workCode: String(u.work_code || ''),
    at: tsToStr(u.read_at || u.create_at),
  }));
}

/**
 * ⭐ 标记周报已读 —— mgo/log/readed，真写操作（轻量）。参数 {log_id}（单数）。
 * Jean live 验证返 {num:1}。看完别人周报标已读（对方能在已读名单看到我）。
 */
async function markWeeklyRead(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const r = ensureRecord(await client.markRead(logId));
  return { ok: true, logId: String(logId), num: Number(r.num || 0) };
}

/** 我的周报收件配置（默认发给谁）*/
async function getWeeklyReceiveConfig() {
  const o = ensureRecord(await client.readReceiveConfig());
  return {
    receiveUserIds: asArray(o.receive_user_ids).map(String),
    receiveUsers: asArray(o.default_receive_user_info || o.receive_users).map((u) => String(u.name || u.user_name || '')).filter(Boolean),
    receiveGroupIds: asArray(o.yach_receive_group_ids).map(String),
    receiveLevels: asArray(o.receive_levels),
  };
}

/** 给周报点赞（写操作）。⚠️ 幂等；取消用 cancelZanWeekly（cancelzan 接口真实存在）。 */
async function zanWeekly(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const obj = await client.zanWeekly(logId);
  const o = ensureRecord(obj);
  return {
    logId: String(logId),
    ok: true,
    zanCount: Number(o.zan_list_count ?? o.zan_count ?? o.count) || undefined,
    isZan: o.is_zan === 1 || o.is_zan === '1' || undefined,
    raw: o,
  };
}

/** ⭐ 取消周报点赞（写操作，真调验证 cancelzan→200）*/
async function cancelZanWeekly(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const o = ensureRecord(await client.cancelZanWeekly(logId));
  return { logId: String(logId), ok: true, raw: o };
}

/** 某周报的点赞人列表（{id,name,pic,uuid}）*/
async function getWeeklyZanUsers(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const obj = ensureRecord(await client.readZanList(logId));
  return asArray(obj.list).map((u) => ({
    userId: String(u.id || u.user_id || ''),
    name: String(u.name || u.user_name || ''),
  }));
}

/** 某周报的评论列表 */
async function getWeeklyComments(logId) {
  if (!logId) throw new Error('logId 不能为空。');
  const obj = ensureRecord(await client.readCommentList(logId));
  return asArray(obj.list).map((c) => ({
    commentId: c.remake_id || c.comment_id || c._id || null, // ⭐ 删评论需这个（remake_id 是服务端拼写）
    userId: String(c.user_id || c.id || ''),
    name: String(c.username || c.user_name || c.name || ''),
    content: stripHtml(String(c.content || c.comment_content || '')),
    replyToId: String(c.remark_to_id || ''),
    replyToName: String(c.remark_to_name || ''),
    at: tsToStr(c.cdate || c.create_at || c.ctime || c.create_time),
  }));
}

function commentIdFromResponse(value) {
  if (!value || typeof value !== 'object') return null;
  for (const key of ['remake_id', 'comment_id', 'commentId', '_id']) {
    const candidate = value[key];
    if (candidate !== undefined && candidate !== null && candidate !== '') return candidate;
  }
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object') {
      const found = commentIdFromResponse(nested);
      if (found !== null) return found;
    }
  }
  return null;
}

function findNewCommentId(before, after, content) {
  const beforeIds = new Set(asArray(before).map((c) => String(c.commentId ?? '')).filter(Boolean));
  const expected = stripHtml(String(content || '')).trim();
  const candidates = asArray(after).filter((c) => {
    const id = String(c.commentId ?? '').trim();
    return id && !beforeIds.has(id) && String(c.content || '').trim() === expected;
  });
  return candidates.length ? candidates[candidates.length - 1].commentId : null;
}

/**
 * ⭐ 给周报评论 —— comment/add，真写操作。参数 {log_id, comment}（真调确认）。
 * opts.replyToId/replyToName 可选（回复某条评论）。对方会看到评论 + 收到提醒。
 */
async function commentWeekly(logId, comment, opts = {}) {
  if (!logId) throw new Error('logId 不能为空。');
  if (!comment || !String(comment).trim()) throw new Error('评论内容不能为空。');
  let before = [];
  try {
    before = await getWeeklyComments(logId);
  } catch {
    // 评论接口仍可独立工作；失败后不能因回读问题重复执行写操作。
  }
  const r = ensureRecord(await client.addComment(logId, comment, {
    remarkToId: opts.replyToId,
    remarkToName: opts.replyToName,
  }));
  let commentId = commentIdFromResponse(r);
  let idResolution = commentId != null ? 'comment-response' : 'unresolved';
  if (commentId == null) {
    try {
      const after = await getWeeklyComments(logId);
      commentId = findNewCommentId(before, after, comment);
      if (commentId != null) idResolution = 'comment-list-diff';
    } catch {
      // 写入已经成功；回读失败不能抛错，否则上层可能重试并产生重复评论。
    }
  }
  return {
    ok: true,
    logId: String(logId),
    commentId,
    idResolution,
    obj: r,
  };
}

/**
 * ⭐ 删除评论 —— delcomment，真写操作。参数 {log_id, comment_id}（真调确认）。
 * commentId = getWeeklyComments 返回的 commentId（即服务端 remake_id）。只能删自己的评论。
 */
async function deleteWeeklyComment(logId, commentId) {
  if (!logId) throw new Error('logId 不能为空。');
  if (commentId === undefined || commentId === null || commentId === '') throw new Error('commentId 不能为空（从 getWeeklyComments 的 commentId 取）。');
  await client.removeComment(logId, commentId);
  return { ok: true, logId: String(logId), commentId };
}

/**
 * ⭐ 关注某人的周报 —— userfans，真写操作。参数 {star_userid}（真调确认）。
 */
async function followUserWeekly(userId) {
  if (!userId) throw new Error('userId 不能为空（来自 yach_search_users）。');
  const r = ensureRecord(await client.followUser(userId));
  return { ok: true, userId: String(userId), num: Number(r.num || 0) || undefined };
}

/** ⭐ 取消关注 —— cancelfans，参数同上。*/
async function unfollowUserWeekly(userId) {
  if (!userId) throw new Error('userId 不能为空。');
  await client.unfollowUser(userId);
  return { ok: true, userId: String(userId) };
}

/**
 * ⭐ 上报对象分类 —— report/category。比 report/employee 更丰富：
 * 上级/同级/我的上报对象/默认收件人 四类。只读。
 */
async function listReportCategory() {
  const o = ensureRecord(await client.readReportCategory());
  const mapUsers = (v) => asArray(ensureRecord(v).list || v).map((u) => ({
    userId: String(u.id || u.user_id || ''),
    name: String(u.name || u.user_name || ''),
    workCode: String(u.work_code || u.workcode || ''),
    dept: String(u.dept_full_name || u.dept || ''),
  }));
  return {
    higher: mapUsers(o.higher_user_info),
    sameLevel: mapUsers(o.same_level_user_info),
    myReport: mapUsers(o.my_report_employee_user_info),
    defaultReceive: mapUsers(o.default_receive_user_info),
  };
}

/**
 * ⭐ 批量查多篇周报的点赞/已读明细（readzan/list，log_ids[] 数组）
 * 返回每篇：{ logId, zanUsers:[{userId,name}], readUsers:[...], zanCount, readCount }
 * 用于“批量判断我是否已赞/已读”（去重），比逐篇查高效。
 */
async function getWeeklyZanReadBatch(logIds) {
  const ids = Array.isArray(logIds) ? logIds : [logIds];
  if (!ids.length) throw new Error('logIds 不能为空。');
  const obj = ensureRecord(await client.readZanReadBatch(ids));
  const mapUser = (u) => ({ userId: String(u.id || u.user_id || ''), name: String(u.name || u.user_name || '') });
  return ids.map((id) => {
    const rec = ensureRecord(obj[String(id)]);
    const zan = asArray(rec.zan_list).map(mapUser);
    const read = asArray(rec.read_list).map(mapUser);
    return { logId: String(id), zanUsers: zan, readUsers: read, zanCount: zan.length, readCount: read.length };
  });
}

/** 未读周报列表 */
async function listUnreadWeekly() {
  const obj = ensureRecord(await client.readUnreadList(1, 50));
  const list = asArray(obj.list).map(normalizeWeekly);
  return { returned: list.length, list };
}

/**
 * ⭐ 上次发送的周报（指定 templateType）—— mgo/log/get/last/send，真调验证 2026-07-13。
 * 用于“参考上次周报”：拿上周各段正文作为本周起草基线。
 */
async function getLastSentWeekly(templateType) {
  const o = ensureRecord(await client.readLastSend(templateType));
  const parseSegs = (v) => readJsonArray(v).map((s) => ({
    title: String(s.title || ''),
    content: String(s.content || ''),
    oId: s.oId != null ? s.oId : null,
    krId: s.krId != null ? s.krId : null,
    okrTitle: s.okrTitle ? stripHtml(String(s.okrTitle)) : '',
    isHi: !!s.isHi,
    countWord: Number(s.count_word) || 0,
  }));
  return {
    logId: String((o._id && typeof o._id === 'object' ? o._id.$oid : o._id) || ''),
    templateType: String(o.template_type || ''),
    templateName: TEMPLATE_TYPE_NAME[Number(o.template_type)] || '周报',
    isSendReportUser: o.is_send_report_user === 1 || o.is_send_report_user === '1',
    createdAt: tsToStr(o.create_at),
    sections: parseSegs(o.content),
    rawContent: typeof o.content === 'string' ? o.content : JSON.stringify(o.content || []),
    rawContentFull: typeof o.content_full === 'string' ? o.content_full : JSON.stringify(o.content_full || []),
  };
}

/** ⭐ 当前周期时间 —— mgo/log/get/time */
async function getWeeklyTime() {
  const o = ensureRecord(await client.readTime());
  return { time: String(o.time || '') };
}

/**
 * ⭐ 上报对象列表 —— mgo/log/report/employee，真调验证 2026-07-13。
 * “我该把周报发给谁”。返回 {isFilter, list:[{userId,name,workCode,dept,levels,userType}]}。
 * 发送周报时取这些 userId 填 receive_user_ids[]。
 */
async function listReportEmployees() {
  const o = ensureRecord(await client.readReportEmployees());
  return {
    isFilter: o.is_filter === 1 || o.is_filter === '1',
    list: asArray(o.list).map((u) => ({
      userId: String(u.id || u.user_id || ''),
      name: String(u.name || ''),
      workCode: String(u.work_code || ''),
      dept: String(u.dept_full_name || ''),
      levels: u.levels != null ? u.levels : '',
      userType: u.user_type != null ? String(u.user_type) : '',
    })),
  };
}

/**
 * ⭐⭐ 按指定人查周报 —— mgo/log/filtersearch，真调验证 2026-07-13。
 * 与 listReceivedWeekly(receive/all 只能看发给我的、假分页硬顶 10 篇) 本质不同：
 *   这里能看**任意指定人**的周报，且**真分页**（能翻完全部历史，total 可达上百篇）。
 * userIds 来自 yach_search_users（先搜人拿 id）。需先有查看权限（checkWeeklyAuthority）。
 */
async function searchUserWeekly(userIds, page = 1, size = 10, unRead = 0) {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String).filter(Boolean);
  if (!ids.length) throw new Error('searchUserWeekly 需 userIds（目标用户 id，来自 yach_search_users）。');
  const pg = Math.max(Number(page) || 1, 1);
  const sz = Math.min(Math.max(Number(size) || 10, 1), 50);
  const obj = ensureRecord(await client.filterSearch(ids, pg, sz, unRead ? 1 : 0));
  const list = asArray(obj.list).map((raw) => {
    const w = normalizeWeekly(raw);
    w.senderUserId = String(raw.send_user_id || '');
    w.sendFrom = String(raw.send_from || '');
    return w;
  });
  return {
    total: Number(obj.total || 0),
    page: pg,
    size: sz,
    returned: list.length,
    note: '真分页，page/size 生效，可翻完全部历史。发报人仅 send_user_id，需 yach_search_users 反查姓名。',
    list,
  };
}

/**
 * ⭐ 周报查看权限校验 —— mgo/log/apply，真调验证 2026-07-13。
 * 返回 {authorized:[{userId,name}], unauthorized:[{userId,name}]}。
 * 查他人周报前先校验，避免 filtersearch 返空时不知道是无权限还是真没周报。
 */
async function checkWeeklyAuthority(userIds) {
  const ids = (Array.isArray(userIds) ? userIds : [userIds]).map(String).filter(Boolean);
  if (!ids.length) throw new Error('checkWeeklyAuthority 需 userIds。');
  const o = ensureRecord(await client.checkAuthority(ids));
  const mapU = (u) => ({ userId: String(u.id || u.user_id || ''), name: String(u.name || '') });
  return {
    authorized: asArray(o.authority_user_list).map(mapU),
    unauthorized: asArray(o.unauthority_user_list).map(mapU),
  };
}

/**
 * ⭐ 存草稿（写操作）—— mgo/log/draft/save。
 * 支持安全段落更新模式，也兼容旧版完整 body，但永远强制为草稿。
 * 真正提交必须走 prepareWeeklySend → submitWeekly → mgo/log/detail/save。
 * ⚠️ 真写操作——调用前需用户确认。不在此拼段落结构/绑 OKR（交给 Agent 层）。
 */
async function saveWeeklyDraft(body) {
  const input = ensureRecord(body);
  if (!Object.keys(input).length) throw new Error('saveWeeklyDraft body 不是有效 JSON 对象。');
  if (input.send === true || String(input.is_send_report_user || '') === '1') {
    throw new Error(
      'yach_save_weekly_draft 只能保存草稿，不能发送。请先调用 yach_prepare_weekly_send，' +
      '再在用户明确确认后调用 yach_submit_weekly。',
    );
  }
  if (input.sectionUpdates || input.templateType) {
    const templateType = String(input.templateType || '3');
    const expectedRevision = String(input.draftRevision || '').trim();
    if (!expectedRevision) {
      throw new Error('保存前必须先调用 yach_get_weekly_draft，并传回其 draftRevision。未发送任何保存请求。');
    }
    if (!asArray(input.sectionUpdates).length) {
      throw new Error('安全更新模式至少需要一个 sectionUpdates，未发送任何保存请求。');
    }
    const draftRaw = ensureRecord(await client.readDraft(templateType));
    if (!Object.keys(draftRaw).length) throw new Error(`未读取到 template_type=${templateType} 的当前草稿。`);
    const actualRevision = computeDraftRevision(draftRaw);
    if (actualRevision !== expectedRevision) {
      throw new Error('周报草稿在读取后已经变化，请重新调用 yach_get_weekly_draft 获取最新内容和 draftRevision。未发送任何保存请求。');
    }
    let content = cloneSections(draftRaw.content);
    let contentFull = cloneSections(draftRaw.content_full);
    let syncResult = { content, contentFull, staleKrIds: [], currentKrIds: [] };
    if (templateType === '3' && input.syncOkr !== false) {
      let structure;
      try {
        structure = await require('../okr/service').getCurrentOkrStructure();
      } catch (error) {
        const loginHint = /token|logout|登录|过期/i.test(String(error.message || ''))
          ? ' 当前知音楼主登录态已过期，请用户重新执行 /yach-login；/yach-refresh-token 只刷新 NIM cloudtoken，不能修复 OKR SSO。'
          : '';
        throw new Error(`无法取得最新 OKR/KR 结构，未保存草稿：${error.message}.${loginHint}`);
      }
      syncResult = syncOkrSections(content, contentFull, structure);
      content = syncResult.content;
      contentFull = syncResult.contentFull;
    }
    const applied = applySectionUpdates(content, contentFull, input.sectionUpdates);
    const payload = {
      ...draftRaw,
      template_type: templateType,
      content: JSON.stringify(content),
      content_full: JSON.stringify(contentFull),
      is_send_report_user: 0,
    };
    if (input.receiveUserIds) payload['receive_user_ids[]'] = asArray(input.receiveUserIds).map(String);
    if (input.receiveGroupIds) payload['yach_receive_group_ids[]'] = asArray(input.receiveGroupIds).map(String);
    await client.saveDraft(payload);
    let saved = null;
    saved = ensureRecord(await client.readDraft(templateType));
    const savedContent = cloneSections(saved.content);
    for (const expected of applied) {
      const actual = savedContent.find((section) => String(section.title) === expected.title);
      if (!actual || String(actual.content || '') !== expected.content) {
        throw new Error(`草稿接口返回成功但读回校验失败：${expected.title}`);
      }
    }
    return {
      ok: true,
      sent: false,
      action: '存草稿',
      templateType,
      applied,
      currentKrIds: syncResult.currentKrIds,
      staleKrIds: syncResult.staleKrIds,
      draftRevision: saved ? computeDraftRevision(saved) : '',
      verified: true,
    };
  }

  const payload = { ...input };
  if (!payload.template_type && payload.template_type !== 0) {
    throw new Error('saveWeeklyDraft 需 template_type（2=普通/3=OKR/6=复盘）。');
  }
  if (Array.isArray(payload.content)) payload.content = JSON.stringify(payload.content);
  if (Array.isArray(payload.content_full)) payload.content_full = JSON.stringify(payload.content_full);
  const o = ensureRecord(await client.saveDraft(payload));
  payload.is_send_report_user = 0;
  const saved = ensureRecord(await client.readDraft(payload.template_type));
  if (cloneSections(payload.content).length && !cloneSections(saved.content).length) {
    throw new Error('草稿接口返回成功但读回内容为空，已判定保存失败。');
  }
  return { ok: true, sent: false, action: '存草稿', templateType: String(payload.template_type), verified: true, raw: o };
}

function weeklyIdOf(value) {
  const o = ensureRecord(value);
  const id = o.weekly_id ?? o.log_id ?? (o._id && typeof o._id === 'object' ? o._id.$oid : o._id);
  return String(id || '');
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value === undefined || value === null || value === '') return [];
  return String(value).split(',').map((x) => x.trim()).filter(Boolean);
}

function buildWeeklySubmitPayload(draft) {
  const o = ensureRecord(draft);
  const receiveUserIds = arrayValue(o.receive_user_ids);
  const receiveOgIds = arrayValue(o.receive_og_ids);
  const receiveLevels = arrayValue(o.receive_levels);
  const receiveGroupIds = arrayValue(o.receive_group_ids);
  const yachReceiveGroupIds = arrayValue(o.yach_receive_group_ids);
  const notifyUserIds = arrayValue(o.notify_user_ids);
  const payload = {
    template_type: String(o.template_type || ''),
    content: typeof o.content === 'string' ? o.content : JSON.stringify(o.content || []),
    content_full: typeof o.content_full === 'string' ? o.content_full : JSON.stringify(o.content_full || []),
    is_share: Number(o.is_share) === 0 ? 0 : 1,
    group_push: Number(o.group_push) === 0 ? 0 : 1,
    imgs: arrayValue(o.imgs).length ? arrayValue(o.imgs) : arrayValue(o.image_urls),
    'receive_og_ids[]': receiveOgIds,
    'receive_user_ids[]': receiveUserIds,
    'receive_levels[]': receiveLevels,
    'receive_group_ids[]': receiveGroupIds,
    receive_group_infos: JSON.stringify(Array.isArray(o.receive_group_infos) ? o.receive_group_infos : []),
    'yach_receive_group_ids[]': yachReceiveGroupIds,
    yach_receive_group_infos: JSON.stringify(
      Array.isArray(o.yach_receive_group_infos) ? o.yach_receive_group_infos : [],
    ),
    'notify_user_ids[]': notifyUserIds,
    send_from: 'yach',
    is_send_report_user: Number(o.is_send_report_user) === 0 ? 0 : 1,
    content_extra_info: typeof o.content_extra_info === 'string'
      ? o.content_extra_info
      : JSON.stringify(o.content_extra_info || {}),
    kr_id: '',
  };
  // 仅供本地发送编排读取，不进入 HTTP 请求。
  Object.defineProperty(payload, '_recipientMeta', {
    value: { receiveUserIds, yachReceiveGroupIds },
    enumerable: false,
  });
  return payload;
}

async function prepareWeeklySend(templateType, draftRevision) {
  const type = String(templateType || '3');
  const expectedRevision = String(draftRevision || '').trim();
  if (!expectedRevision) throw new Error('发送准备前必须先读取草稿并传入 draftRevision。');
  const draft = ensureRecord(await client.readDraft(type));
  const actualRevision = computeDraftRevision(draft);
  if (actualRevision !== expectedRevision) {
    throw new Error('草稿已经变化，请重新读取并审阅后再准备发送。');
  }
  const fingerprint = `${type}:${actualRevision}`;
  const existingToken = weeklySendFingerprints.get(fingerprint);
  const existing = existingToken && weeklySendPreparations.get(existingToken);
  if (existing && existing.expiresAt > Date.now() && ['prepared', 'inflight', 'sent', 'uncertain'].includes(existing.state)) {
    return {
      sendToken: existingToken,
      expiresAt: new Date(existing.expiresAt).toISOString(),
      draftRevision: actualRevision,
      templateType: type,
      recipientUserIds: existing.recipientUserIds,
      recipientGroupIds: existing.recipientGroupIds,
      reused: true,
    };
  }
  const latest = ensureRecord(await client.readLastSend(type));
  const token = crypto.randomUUID();
  const payload = buildWeeklySubmitPayload(draft);
  const entry = {
    state: 'prepared',
    expiresAt: Date.now() + WEEKLY_SEND_TOKEN_TTL_MS,
    draftRevision: actualRevision,
    templateType: type,
    baselineWeeklyId: weeklyIdOf(latest),
    recipientUserIds: payload.receive_user_ids,
    recipientGroupIds: payload.yach_receive_group_ids,
  };
  weeklySendPreparations.set(token, entry);
  weeklySendFingerprints.set(fingerprint, token);
  return {
    sendToken: token,
    expiresAt: new Date(entry.expiresAt).toISOString(),
    draftRevision: actualRevision,
    templateType: type,
    recipientUserIds: entry.recipientUserIds,
    recipientGroupIds: entry.recipientGroupIds,
    reused: false,
  };
}

async function submitWeekly(sendToken) {
  const token = String(sendToken || '').trim();
  const entry = weeklySendPreparations.get(token);
  if (!entry) throw new Error('发送令牌无效或网关已重启；请重新读取草稿并准备发送。');
  if (entry.state === 'sent') {
    return { sent: true, duplicatePrevented: true, weeklyId: entry.weeklyId, verified: true };
  }
  if (entry.state === 'inflight' || entry.state === 'uncertain') {
    throw new Error('该发送令牌已使用或结果待确认。为防止重复发送，禁止重试；请查询已发送周报确认。');
  }
  if (entry.expiresAt <= Date.now()) {
    entry.state = 'expired';
    throw new Error('发送令牌已过期；请重新读取并审阅草稿。');
  }
  const draft = ensureRecord(await client.readDraft(entry.templateType));
  if (computeDraftRevision(draft) !== entry.draftRevision) {
    entry.state = 'stale';
    throw new Error('准备发送后草稿又被修改，已阻止发送。请重新读取并确认。');
  }
  const latestBefore = ensureRecord(await client.readLastSend(entry.templateType));
  if (weeklyIdOf(latestBefore) !== entry.baselineWeeklyId) {
    entry.state = 'stale';
    throw new Error('准备发送后检测到新的已发送周报，已阻止再次提交。');
  }
  entry.state = 'inflight';
  try {
    const payload = buildWeeklySubmitPayload(draft);
    const recipientMeta = payload._recipientMeta;
    const response = ensureRecord(await client.submitWeekly(payload));
    const weeklyId = weeklyIdOf(response);
    if (!weeklyId) {
      entry.state = 'uncertain';
      throw new Error('提交接口未返回 weekly_id，结果不确定。为防止重复发送，禁止重试；请查询已发送周报。');
    }
    let groupNotification = { required: false, sent: true, groupCount: 0 };
    if (Number(draft.group_push) !== 0 && recipientMeta.yachReceiveGroupIds.length) {
      const saltValue = String(response.salt_value || '').trim()
        || String(ensureRecord(await client.getWeeklySalt(weeklyId)).salt_value || '').trim();
      if (!saltValue) {
        entry.state = 'uncertain';
        throw new Error(
          `周报 ${weeklyId} 已创建，但无法取得通知 salt，群通知结果不确定。禁止重新提交周报；可仅补发通知。`,
        );
      }
      await client.sendWeeklyToGroups(weeklyId, recipientMeta.yachReceiveGroupIds, saltValue);
      groupNotification = {
        required: true,
        sent: true,
        groupCount: recipientMeta.yachReceiveGroupIds.length,
      };
    }
    entry.state = 'sent';
    entry.weeklyId = weeklyId;
    let verified = false;
    try {
      const latestAfter = ensureRecord(await client.readLastSend(entry.templateType));
      verified = weeklyIdOf(latestAfter) === weeklyId;
    } catch {}
    return {
      sent: true,
      duplicatePrevented: false,
      weeklyId,
      verified,
      recipientUserCount: recipientMeta.receiveUserIds.length,
      groupNotification,
    };
  } catch (error) {
    if (entry.state === 'inflight') entry.state = 'uncertain';
    throw error;
  }
}

module.exports = {
  listWeeklyTemplates,
  getWeeklyDraft,
  getLastSentWeekly,
  getWeeklyTime,
  listReportEmployees,
  listReportCategory,
  searchUserWeekly,
  checkWeeklyAuthority,
  commentWeekly,
  deleteWeeklyComment,
  followUserWeekly,
  unfollowUserWeekly,
  saveWeeklyDraft,
  prepareWeeklySend,
  submitWeekly,
  listSentWeekly,
  listReceivedWeekly,
  listWeeklyEvents,
  listWeeklyWeeks,
  listStarWeekly,
  getWeeklyDetail,
  getWeeklyReaders,
  markWeeklyRead,
  getWeeklyReceiveConfig,
  zanWeekly,
  cancelZanWeekly,
  getWeeklyZanUsers,
  getWeeklyComments,
  commentIdFromResponse,
  findNewCommentId,
  syncOkrSections,
  applySectionUpdates,
  computeDraftRevision,
  isNoProgressPlaceholder,
  ensureRequiredNonOkrSections,
  buildWeeklySubmitPayload,
  getWeeklyZanReadBatch,
  listUnreadWeekly,
  normalizeWeekly,
};
