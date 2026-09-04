/**
 * 工资条 API（payroll-api.zhiyinlou.com）
 *
 * ⚠️ 认证特殊说明：
 *   payroll-api 域名做了 Certificate Pinning，与 yach-capi 完全独立。
 *   认证走 JWT（admin_token），有效期 1 小时；本插件只接受
 *   yach-im-full 插件配置中的 payrollAdminToken（建议使用 SecretRef），不读取
 *   浏览器、桌面应用或系统 Cookie，也不会把工资条凭据写入 session 或其他本地文件。
 *
 * 实测接口（2026-07-14）：
 *   POST api/ding/payroll       ✅ 当月/翻页工资条详情（核心接口）
 *   POST api/ding/payroll/list  ⚠️  历史列表（token 过期时 401；参数 channel+token）
 *   GET  api/ding/payroll/satisfaction/is_exist/{id}  ✅ 满意度评价状态
 *
 * 逆向参考：
 *   文档：docs/知音楼接口参数文档.md §工资条 API
 *   H5 代码：https://payroll.zhiyinlou.com/assets/js/app.5c8ef44d.js
 *   axios 拦截器 module "9394"，Cookie 工具 module "4efd"
 */

const https = require('https');
const querystring = require('querystring');

const PAYROLL_BASE = 'https://payroll-api.zhiyinlou.com';
const PAYROLL_ORIGIN = 'https://payroll.zhiyinlou.com';
// 知音楼 iPad 渠道 = 2，AppID = 372229400
const YACH_CHANNEL = '2';
const YACH_APPID = '372229400';
let configuredPayrollToken = '';

// ── token 管理 ─────────────────────────────────────────────────────────────

/** 获取显式配置的有效 admin_token。 */
function getAdminToken() {
  const token = getConfiguredPayrollToken();
  if (token && isTokenValid(token)) return token;
  throw new Error(
    '工资条凭据缺失或已过期（admin_token 有效期约 1 小时）。\n' +
    '请由管理员在 yach-im-full 插件配置中通过受控 SecretRef 配置 payrollAdminToken，' +
    '然后再调用 yach_refresh_payroll_token。插件不会读取本机应用、浏览器或系统凭据文件。'
  );
}

/**
 * 由 OpenClaw Gateway 注入已经解析的 SecretRef 值。
 * 该模块只在进程内短暂保存，不落盘、不回写配置。
 */
function configurePayrollToken(value) {
  configuredPayrollToken = typeof value === 'string' ? value.trim() : '';
}

function getConfiguredPayrollToken() {
  return configuredPayrollToken;
}

/**
 * 检查 JWT 是否未过期（留 60 秒余量）
 */
function isTokenValid(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
    return payload.exp > Math.floor(Date.now() / 1000) + 60;
  } catch {
    return false;
  }
}

// ── HTTP 请求 ───────────────────────────────────────────────────────────────

/**
 * payroll-api 专用 POST（form-urlencoded，Bearer JWT 认证）
 */
function payrollPost(path, body = {}) {
  const token = getAdminToken();
  const data = querystring.stringify({ ...body, token, channel: YACH_CHANNEL });
  return new Promise((resolve, reject) => {
    const url = new URL(PAYROLL_BASE + '/' + path);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json',
        'Origin': PAYROLL_ORIGIN,
        'Referer': PAYROLL_ORIGIN + '/',
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', c => {
        size += c.length;
        if (size > 5 * 1024 * 1024) {
          res.destroy(new Error('payroll 响应过大'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 401) {
          reject(new Error('payroll admin_token 已过期，请更新 yach-im-full 配置中的 payrollAdminToken'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`payroll HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
      res.on('error', reject);
    });
    req.setTimeout(20_000, () => req.destroy(new Error('payroll 请求超时')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/**
 * payroll-api 专用 GET
 */
function payrollGet(path, params = {}) {
  const token = getAdminToken();
  const qs = querystring.stringify({ ...params, token, channel: YACH_CHANNEL });
  return new Promise((resolve, reject) => {
    const url = new URL(PAYROLL_BASE + '/' + path + '?' + qs);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Origin': PAYROLL_ORIGIN,
        'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      },
    }, res => {
      const chunks = [];
      let size = 0;
      res.on('data', c => {
        size += c.length;
        if (size > 5 * 1024 * 1024) {
          res.destroy(new Error('payroll 响应过大'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode === 401) {
          reject(new Error('payroll admin_token 已过期'));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`payroll HTTP ${res.statusCode}: ${raw.slice(0, 300)}`));
          return;
        }
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
      res.on('error', reject);
    });
    req.setTimeout(20_000, () => req.destroy(new Error('payroll 请求超时')));
    req.on('error', reject);
    req.end();
  });
}

// ── 业务接口 ───────────────────────────────────────────────────────────────

/** 检查显式配置的 admin_token，不回显、不持久化凭据。 */
async function refreshPayrollToken() {
  const token = getConfiguredPayrollToken();
  if (!token || !isTokenValid(token)) {
    throw new Error(
      '未配置有效的工资条 admin_token。请在 yach-im-full 插件配置中通过 SecretRef ' +
      '显式提供 payrollAdminToken；不会自动读取本机应用或浏览器凭据。'
    );
  }
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  return {
    token: '已配置（不回显）',
    exp: new Date(payload.exp * 1000).toLocaleString('zh-CN'),
    sub: payload.sub,
    iss: payload.iss,
  };
}

/**
 * 获取工资条详情
 *
 * @param {{ page?: 'C'|'P'|'N', calId?: string }} opts
 *   page: C=当期(默认), P=上月, N=下月
 *   calId: 翻页时传上次响应的 calId（格式 "PAY YYYY/MM"）
 *
 * @returns {Promise<PayrollResult>}
 *   - month: 'YYYY-MM'
 *   - title: '工资条'
 *   - calId: 'PAY YYYY/MM'（用于翻页）
 *   - gross: 应发工资（string）
 *   - net: 实发工资（string）
 *   - items: 明细项数组
 */
async function getPayroll({ page = 'C', calId = '' } = {}) {
  const r = await payrollPost('api/ding/payroll', { page, calId });
  if (!r.data || !Array.isArray(r.data)) {
    throw new Error(`getPayroll 响应异常: ${JSON.stringify(r).slice(0, 200)}`);
  }
  const first = r.data[0];
  if (!first) throw new Error('工资条数据为空（当月可能未出）');
  const detail = first.detail?.[0] ?? {};
  return {
    month:  first.prdId,
    title:  first.title,
    calId:  first.calId,
    gross:  detail.payableWages,
    net:    detail.realWages ?? first.realWagesSum,
    items:  (detail.items ?? []).map(it => ({
      name:   it.itemType,
      amount: it.itemAmount,
      details: (it.itemDetails ?? []).map(d => ({ desc: d.desc, value: d.value })),
    })),
    raw: first,
  };
}

/**
 * 获取历史工资条列表
 * @returns {Promise<Array>}
 */
async function getPayrollList() {
  const r = await payrollPost('api/ding/payroll/list', {});
  if (!r.data) throw new Error(`getPayrollList 失败: ${JSON.stringify(r).slice(0, 200)}`);
  return Array.isArray(r.data) ? r.data : r;
}

/**
 * 获取多个月份工资条（自动翻页）
 * @param {number} months 要获取的月数（1-12，默认 3）
 * @returns {Promise<Array<PayrollResult>>}
 */
async function getPayrollHistory(months = 3) {
  const results = [];
  // 先拿当月
  const current = await getPayroll({ page: 'C' });
  results.push(current);
  // 往前翻
  let calId = current.calId;
  for (let i = 1; i < months; i++) {
    try {
      const prev = await getPayroll({ page: 'P', calId });
      if (!prev.calId || prev.calId === calId) break; // 没有更早数据了
      results.push(prev);
      calId = prev.calId;
    } catch { break; }
  }
  return results;
}

module.exports = {
  refreshPayrollToken,
  getPayroll,
  getPayrollList,
  getPayrollHistory,
  // 内部工具（供测试用）
  configurePayrollToken,
  getAdminToken,
  getConfiguredPayrollToken,
  isTokenValid,
};
