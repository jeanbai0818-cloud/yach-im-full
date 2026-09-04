/**
 * OKR 业务编排（读能力 + token 生命周期）
 *
 * 对外只读能力：
 *   listOkrTemplates()            列 OKR 周期模板
 *   listMyOkrs({view?})           列我的 OKR（view: all/annual/quarter/last-year）
 *   getOkrDetail(id)              看某条 OKR 详情（objectives + krs）
 *
 * token 生命周期：expiresAt 前 60s 视为过期，自动重新换票；接口报鉴权错误时重登重试一次。
 * 逻辑参照旧插件 yach-omni-2.1.5 okr/service.js，改写为 CJS，聚焦读能力。
 * ⚠️ 创建/更新 OKR 是复杂重写流程（HTML 富文本 + 快照文件），暂未移植。
 */
'use strict';

const { loginOkr, requestOkrData } = require('./client');
const { readStoredOkrSession, writeStoredOkrSession } = require('./store');

const OKR_PAGE_SIZE = 20;
const TOKEN_SKEW_MS = 60 * 1000;

function ensureRecord(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
}
function asArray(v) {
  return Array.isArray(v) ? v : [];
}
function readString(v) {
  return String(v || '').trim();
}
function readNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function readBoolean(v) {
  return v === true || v === 1 || v === '1' || v === 'true';
}
function cleanHtmlText(v) {
  return String(v || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isUsableOkrSession(s) {
  return Boolean(s && s.accessToken && s.expiresAt && s.expiresAt - Date.now() > TOKEN_SKEW_MS);
}
function looksLikeAuthError(error) {
  const msg = String(error?.message || '').toLowerCase();
  return (
    error?.okrStatus === 401 ||
    error?.okrStatus === 403 ||
    /unauth|token|登录|登陆|expired|过期/.test(msg)
  );
}

// ── 归一化 ──────────────────────────────────────────────────

function templateYear(t) {
  const m = String(t.title || '').match(/(20\d{2})/);
  return m ? Number(m[1]) : new Date(readString(t.start) || Date.now()).getFullYear();
}
function isAnnualTemplate(t) {
  return String(t.type) === '365' || /年度/.test(t.title || '');
}
function isQuarterTemplate(t) {
  return /^\dQ$/i.test(String(t.type)) || String(t.type) === '91' || /季度/.test(t.title || '');
}

function normalizeTemplate(raw) {
  const id = readNumber(raw.id);
  if (id === null) return null;
  const start = readString(raw.start || raw.start_date || raw.begin);
  const end = readString(raw.end || raw.end_date || raw.finish);
  const now = Date.now();
  const startAt = Date.parse(start);
  const endAt = Date.parse(end);
  const currentByRange =
    Number.isFinite(startAt) && Number.isFinite(endAt) && startAt <= now && now <= endAt;
  return {
    id,
    type: readString(raw.type || raw.template_type),
    title: readString(raw.title || raw.name),
    start,
    end,
    current: readBoolean(raw.current ?? raw.is_current ?? raw.isCurrent) || currentByRange,
  };
}

function normalizeSnapshotObjectives(rawList) {
  return asArray(rawList)
    .filter((o) => !readBoolean(o.is_deleted))
    .map((o) => {
      const krs = asArray(o.krs).filter((kr) => !readBoolean(kr.is_deleted));
      return {
        id: readNumber(o.id || o.o_id || o.oId),
        title: cleanHtmlText(o.title),
        krCount: krs.length,
        krs: krs.map((kr) => ({
          id: readNumber(kr.id || kr.kr_id || kr.krId),
          title: cleanHtmlText(kr.title),
          progress: readString(kr.progress),
        })),
        promiseStatus: readNumber(o.promise_status) ?? 0,
      };
    })
    .filter((o) => o.title || o.krCount > 0);
}

function normalizeListItem(raw) {
  const id = readNumber(raw.id);
  if (id === null) return null;
  const template = ensureRecord(raw.template);
  const objectives = normalizeSnapshotObjectives(asArray(raw.os));
  const titlePreview = objectives.slice(0, 3).map((o) => o.title).filter(Boolean).join(' | ');
  return {
    id,
    templateId: readNumber(raw.template_id || template.id) ?? 0,
    templateTitle: readString(template.title || raw.template_title),
    templateType: readString(template.type || raw.template_type),
    createdAt: readString(raw.created_at),
    updatedAt: readString(raw.updated_at),
    status: readNumber(raw.status) ?? 0,
    objectiveCount: objectives.length,
    krCount: objectives.reduce((t, o) => t + o.krCount, 0),
    sensitive: readBoolean(raw.enable_sensitive || raw.sensitive),
    titlePreview,
  };
}

function pickTemplatesForView(templates, view) {
  if (view === 'all') return templates;
  const curYear = new Date().getFullYear();
  const filtered = templates.filter((t) => {
    const year = templateYear(t);
    if (view === 'annual') return isAnnualTemplate(t) && year === curYear;
    if (view === 'quarter') return isQuarterTemplate(t) && year === curYear;
    return isAnnualTemplate(t) && year === curYear - 1; // last-year
  });
  return filtered;
}

// ── token 生命周期 ──────────────────────────────────────────

async function ensureSession() {
  let session = readStoredOkrSession();
  const existingCid = session?.cid;
  if (!isUsableOkrSession(session)) {
    session = await loginOkr(existingCid);
    writeStoredOkrSession(session);
  }
  return session;
}

async function withOkr(task) {
  let session = await ensureSession();
  try {
    return await task(session);
  } catch (error) {
    if (!looksLikeAuthError(error)) throw error;
    session = await loginOkr(session.cid);
    writeStoredOkrSession(session);
    return task(session);
  }
}

// ── 对外读能力 ──────────────────────────────────────────────

async function listOkrTemplates() {
  return withOkr(async (session) => {
    const payload = await requestOkrData(session, { method: 'GET', path: '/api/templates' });
    return asArray(payload.data).map(normalizeTemplate).filter(Boolean);
  });
}

async function listMyOkrs(opts = {}) {
  const view = opts.view || 'all';
  return withOkr(async (session) => {
    const bucket = [];
    let page = 1;
    for (;;) {
      const payload = await requestOkrData(session, {
        method: 'GET',
        path: '/api/v2/okr',
        params: { page, per_page: OKR_PAGE_SIZE },
      });
      const data = ensureRecord(payload.data);
      const items = asArray(data.data).map(normalizeListItem).filter(Boolean);
      bucket.push(...items);
      const total = readNumber(data.total) ?? bucket.length;
      const currentPage = readNumber(data.current_page) ?? page;
      if (bucket.length >= total || items.length === 0 || currentPage < page) break;
      page = currentPage + 1;
    }
    let items = bucket;
    let templates = [];
    if (view !== 'all') {
      const tPayload = await requestOkrData(session, { method: 'GET', path: '/api/templates' });
      templates = asArray(tPayload.data).map(normalizeTemplate).filter(Boolean);
      const selected = pickTemplatesForView(templates, view);
      const ids = new Set(selected.map((t) => t.id));
      if (ids.size > 0) items = items.filter((i) => ids.has(i.templateId));
      else {
        const curYear = new Date().getFullYear();
        items = items.filter((i) => {
          const y = Number((i.templateTitle.match(/(20\d{2})/) || [])[1]) || curYear;
          if (view === 'annual') return y === curYear && i.templateTitle.includes('年度');
          if (view === 'quarter') return y === curYear && i.templateTitle.includes('季度');
          return y === curYear - 1 && i.templateTitle.includes('年度');
        });
      }
    }
    return { view, total: items.length, items };
  });
}

async function getOkrDetail(id) {
  const okrId = readString(id);
  if (!okrId) throw new Error('OKR id 不能为空。');
  return withOkr(async (session) => {
    // ⭐ /api/okr/{id} 只返回摘要元数据（os_count/krs_count），objective 明细在
    //   编辑态 /api/v2/okr/edit/{id} 的 okrs 里（含 title/krs 完整 HTML）。
    const meta = ensureRecord((await requestOkrData(session, { method: 'GET', path: `/api/okr/${encodeURIComponent(okrId)}` })).data);
    let objectives = [];
    try {
      const edit = ensureRecord((await requestOkrData(session, { method: 'GET', path: `/api/v2/okr/edit/${encodeURIComponent(okrId)}` })).data);
      objectives = normalizeSnapshotObjectives(asArray(edit.okrs || edit.os));
    } catch {
      /* 编辑态拿不到就只给摘要 */
    }
    return {
      id: readNumber(meta.id) ?? okrId,
      templateTitle: readString(meta.template_title),
      userName: readString(meta.user_name),
      updatedAt: readString(meta.updated_at),
      objectiveCount: objectives.length || (readNumber(meta.os_count) ?? 0),
      krCount: readNumber(meta.krs_count) ?? 0,
      published: readBoolean(meta.is_published),
      objectives,
    };
  });
}

async function getCurrentOkrStructure() {
  const templates = await listOkrTemplates();
  const currentTemplates = templates.filter((t) => t.current);
  const currentQuarterly = currentTemplates.filter(isQuarterTemplate);
  const selectedTemplates = currentQuarterly.length ? currentQuarterly : currentTemplates;
  const currentIds = new Set(selectedTemplates.map((t) => t.id));
  if (!currentIds.size) throw new Error('OKR 服务未返回当前周期模板，已停止周报结构同步。');
  const listed = await listMyOkrs({ view: 'all' });
  const current = listed.items.filter((item) => currentIds.has(item.templateId));
  const objectives = [];
  for (const item of current) {
    const detail = await getOkrDetail(item.id);
    detail.objectives.forEach((objective, objectiveIndex) => {
      if (objective.id == null) return;
      objectives.push({
        id: objective.id,
        title: objective.title,
        order: objectives.length + 1,
        krs: objective.krs
          .filter((kr) => kr.id != null)
          .map((kr, krIndex) => ({
            id: kr.id,
            title: kr.title,
            order: krIndex + 1,
            okrTitle: `O${objectives.length + 1}-KR${krIndex + 1}：${kr.title}`,
          })),
      });
    });
  }
  if (!objectives.length) throw new Error('当前周期没有可用于周报的 Objective/KR，已停止保存。');
  return { templates: selectedTemplates, objectives };
}

module.exports = {
  listOkrTemplates,
  listMyOkrs,
  getOkrDetail,
  getCurrentOkrStructure,
  normalizeTemplate,
};
