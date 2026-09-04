/**
 * 工资条 API（payroll-api.zhiyinlou.com）
 *
 * ⚠️ 认证特殊说明：
 *   payroll-api 域名做了 Certificate Pinning，与 yach-capi 完全独立。
 *   认证走 JWT（admin_token），有效期 1 小时，来源两种：
 *     1. 自动读取：从 App 沙盒 Cookies.binarycookies 提取（macOS/iPad 本机有效）
 *     2. 手动注入：将 admin_token 存入 session 的 payroll_token 字段
 *
 *   admin_token 刷新流程需要 App 原生生成 Laravel 加密 token（走 pinned 域名），
 *   目前无法全自动刷新，需用户打开知音楼工资条页面后提取。
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
const os = require('os');
const querystring = require('querystring');
const { loadSession } = require('../../../auth/session');
const { spawnSync } = require('child_process');

const PAYROLL_BASE = 'https://payroll-api.zhiyinlou.com';
const PAYROLL_ORIGIN = 'https://payroll.zhiyinlou.com';
// 知音楼 iPad 渠道 = 2，AppID = 372229400
const YACH_CHANNEL = '2';
const YACH_APPID = '372229400';

// ── token 管理 ─────────────────────────────────────────────────────────────

/**
 * 获取有效的 admin_token：
 *   1. session.payroll_token（手动注入或上次登录缓存）
 *   2. 从 App 沙盒 Cookies.binarycookies 自动提取（macOS 本机）
 * @returns {string} JWT
 */
function getAdminToken() {
  const session = loadSession();
  if (session.payroll_token && isTokenValid(session.payroll_token)) {
    return session.payroll_token;
  }
  // 尝试从 App Cookie 文件自动提取
  const extracted = extractFromBinaryCookies();
  if (extracted) return extracted;
  throw new Error(
    'payroll admin_token 不存在或已过期（1小时有效期）。\n' +
    '请先在知音楼 App 打开工资条页面，然后调用 yach_refresh_payroll_token 提取 token。'
  );
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

/**
 * 从 App 沙盒 Cookies.binarycookies 自动提取 payroll admin_token
 * 仅 macOS 本机有效，需知音楼 App 已打开过工资条页面
 * @returns {string|null}
 */
function extractFromBinaryCookies() {
  // 知音楼 iPad 和 Mac 沙盒容器路径
  const homeDir = os.homedir();
  const COOKIE_PATHS = [
    `${homeDir}/Library/Containers/com.100tal.yach.ipad/Data/Library/Cookies/Cookies.binarycookies`,
    `${homeDir}/Library/Containers/com.100tal.yach.mac/Data/Library/Cookies/Cookies.binarycookies`,
    `${homeDir}/Library/Containers/com.100tal.yach/Data/Library/Cookies/Cookies.binarycookies`,
  ];
  for (const p of COOKIE_PATHS) {
    try {
      const fs = require('fs');
      if (!fs.existsSync(p)) continue;
      // 使用参数数组调用 strings，避免把路径拼进 shell 命令。
      const result = spawnSync('strings', [p], {
        encoding: 'utf8',
        timeout: 5000,
        maxBuffer: 8 * 1024 * 1024,
      });
      const out = String(result.stdout || '').trim();
      if (!out) continue;
      const tokens = out.split('\n').filter(t => t.startsWith('eyJ'));
      for (const tok of tokens) {
        if (!isTokenValid(tok)) continue;
        try {
          const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64').toString());
          // 找 iss 为 payroll-api 的 JWT（排除 hrssc-api JWT）
          if (payload.iss && payload.iss.includes('payroll-api.zhiyinlou.com')) {
            return tok;
          }
        } catch { continue; }
      }
    } catch { continue; }
  }
  return null;
}

/**
 * 把 admin_token 存入 session（延长可用时间）
 */
function cacheAdminToken(token) {
  try {
    const { saveSession } = require('../../../auth/session');
    const session = loadSession();
    saveSession({ ...session, payroll_token: token });
  } catch { /* 缓存失败不影响主流程 */ }
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
          reject(new Error('payroll admin_token 已过期，请重新打开知音楼工资条页面后提取 token'));
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

/**
 * 提取/刷新 admin_token
 * 先尝试从 App Cookie 文件自动提取，失败时抛出操作指引
 * @returns {{ token: string, exp: Date, sub: number }}
 */
async function refreshPayrollToken() {
  const token = extractFromBinaryCookies();
  if (!token) {
    throw new Error(
      '未能从 App Cookie 文件提取 payroll token。\n' +
      '请确认：\n' +
      '1. 知音楼 App 已安装在本机（Mac/iPad）\n' +
      '2. 已在 App 内打开"工资条"页面（5分钟内）\n' +
      '3. 运行环境可访问 ~/Library/Containers/com.100tal.yach.*/Data/Library/Cookies/'
    );
  }
  cacheAdminToken(token);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
  return {
    token: token.slice(0, 20) + '...(已缓存)',
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
  getAdminToken,
  isTokenValid,
  extractFromBinaryCookies,
};
