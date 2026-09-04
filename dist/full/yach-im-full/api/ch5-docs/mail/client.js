/**
 * 企业邮箱客户端（网易企业邮 / Coremail 内核，mailh.qiye.163.com/js6）
 *
 * ⭐ 破解要点（修复旧插件已失效的邮件登录）：
 *   知音楼企业邮做过安全升级，旧客户端版本号（1.9.19.12）被服务端风控，
 *   POST 94capi/txmail/login 只返回"请升级客户端"的静态页。
 *   **传 client-ver >= 2.0.0.5 即放行**，返回真正的网易企业邮 SSO 登录 URL：
 *     entry.qiye.163.com/login/ssoLogin?sso_token=***
 *   跟随重定向落到 mailh.qiye.163.com/js6/main.jsp?sid=***，收 Coremail cookie，
 *   从 HTML 提取 sid。之后所有收发件走标准 Coremail wmsvr 协议：
 *     POST /js6/s?sid=X&func=mbox:xxx   body: var=<XML>
 *
 * 逻辑参照旧插件 yach-omni-2.1.5 mail-auth/mail-send client.js，改写为 CJS，
 * 复用当前项目的 capi 签名（自定义带 client-ver 的请求头）。
 */
'use strict';

const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const querystring = require('node:querystring');
const { createCipheriv } = require('node:crypto');
const { getSign } = require('../../../utils/sign');
const { loadSession } = require('../../../auth/session');
const { resolveSafeFile } = require('../../../utils/safe-file');
const {
  followBrowserRedirects,
  buildCookieHeader,
  mergeCookies,
  extractCookiesFromResponse,
  fetchWithTimeout,
} = require('../../../utils/web-request');

const CAPI_BASE = 'https://yach-capi.zhiyinlou.com';
const TXMAIL_LOGIN_PATH = '94capi/txmail/login';
const MAIL_CLIENT_VERSION = '2.1.0'; // ⭐ 必须 >= 2.0.0.5，否则被风控返回升级页
const S_OK = 'S_OK';
const GKEY = 'SDJ0U#$2io9F&#*J';
const SENT_FOLDER_ID = 3;
const MAIL_SEND_PROFILE = Object.freeze({
  action: 'send',
  riskHitIntercept: false,
  returnInfo: true,
  saveSentCopy: true,
});

// 附件 Content-Type 映射（同旧包 mail-send/client.js）
const DEFAULT_UPLOAD_CONTENT_TYPE = 'application/octet-stream';
const CONTENT_TYPE_BY_EXTENSION = {
  csv: 'text/csv', gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  jpeg: 'image/jpeg', jpg: 'image/jpeg', json: 'application/json',
  pdf: 'application/pdf', png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  svg: 'image/svg+xml', txt: 'text/plain', webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};
function inferContentType(filename) {
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '');
  return CONTENT_TYPE_BY_EXTENSION[ext] || DEFAULT_UPLOAD_CONTENT_TYPE;
}
function readUploadAttachmentId(response) {
  const r = response && typeof response === 'object' ? response : {};
  if (r.attachId !== undefined && r.attachId !== null) return String(r.attachId);
  const nested = r.var && typeof r.var === 'object' ? r.var : {};
  if (nested.attachmentId !== undefined && nested.attachmentId !== null) return String(nested.attachmentId);
  if (nested.attachId !== undefined && nested.attachId !== null) return String(nested.attachId);
  return '';
}

function ensureRecord(v) {
  return v && typeof v === 'object' ? v : {};
}
function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function formatDate(d) {
  return d.toISOString();
}

/** Coremail XML body 序列化（<object>/<array>/<string>/<int>/...）*/
function serializeMailBody(value) {
  function encode(entry, name) {
    let tag = 'null';
    let content = '';
    let children = '';
    if (entry !== null && entry !== undefined) {
      if (typeof entry === 'boolean') {
        tag = 'boolean';
        content = entry ? 'true' : 'false';
      } else if (typeof entry === 'string') {
        tag = 'string';
        content = escapeXml(entry.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ''));
      } else if (typeof entry === 'number') {
        tag = String(entry).includes('.') ? 'number' : entry < -2147483648 || entry >= 2147483648 ? 'long' : 'int';
        content = String(entry);
      } else if (entry instanceof Date) {
        tag = 'date';
        content = formatDate(entry);
      } else if (Array.isArray(entry)) {
        tag = 'array';
        children = entry.map((item) => encode(item)).join('');
      } else if (typeof entry === 'object') {
        tag = 'object';
        children = Object.entries(entry)
          .filter(([, item]) => item !== undefined && typeof item !== 'function')
          .map(([key, item]) => encode(item, key))
          .join('');
      }
    }
    const nameAttr = name ? ` name="${escapeXml(name)}"` : '';
    if (!content && !children) return `<${tag}${nameAttr}/>`;
    return `<${tag}${nameAttr}>${content}${children}</${tag}>`;
  }
  return `<?xml version="1.0"?>${encode(value)}`;
}

/** 解析 Coremail 松散 JS 对象响应 */
function parseLooseMailResponse(raw) {
  const text = String(raw || '').trim();
  if (!text) throw new Error('企业邮箱接口返回了空响应。');
  const parsed = vm.runInNewContext(`(${text})`);
  if (!parsed || typeof parsed !== 'object') throw new Error('企业邮箱接口返回了无法识别的响应。');
  return parsed;
}

function readMailSid(html) {
  for (const p of [/sid:'([^']+)'/i, /sid:"([^"]+)"/i, /"sid":"([^"]+)"/i]) {
    const m = p.exec(html);
    if (m?.[1]) return m[1];
  }
  return '';
}

function resolveMailPlatform() {
  if (process.platform === 'darwin') return 'mac';
  if (process.platform === 'win32') return 'pc';
  return 'pc';
}

function mailUserAgent() {
  return `Mozilla/5.0 Yach/${MAIL_CLIENT_VERSION} Yachlang/zh-CN`;
}

// ── 换 login_url（带高 client-ver 绕过风控）─────────────────

function buildMailLoginHeaders(session, sign, timestamp) {
  const cipher = createCipheriv('aes-128-ecb', Buffer.from(GKEY), null);
  const gtoken = Buffer.concat([cipher.update(`${session.workcode}_1`), cipher.final()]).toString('base64');
  return {
    Authorization: session.token,
    workcode: session.workcode,
    deptid: session.deptid,
    sign,
    timestamp: String(timestamp),
    gtoken,
    'client-ver': MAIL_CLIENT_VERSION,
    'content-language': 'zh-cn',
    'CONTENT-LANGUAGE': 'zh-cn',
    Accept: 'application/json, text/javascript',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': mailUserAgent(),
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  };
}

async function requestMailLogin() {
  const session = loadSession();
  const body = { from: 'email', plat: resolveMailPlatform() };
  const { sign, timestamp } = getSign(body);
  const headers = buildMailLoginHeaders(session, sign, timestamp);
  const url = `${CAPI_BASE}/${TXMAIL_LOGIN_PATH}?sign=${sign}&timestamp=${timestamp}`;
  const response = await fetchWithTimeout(url, { method: 'POST', headers, body: querystring.stringify(body) });
  const payload = ensureRecord(await response.json());
  if (Number(payload.code || 0) !== 200) throw new Error(payload.msg || '企业邮箱登录入口获取失败。');
  const obj = ensureRecord(payload.obj);
  const email = String(obj.email || '').trim();
  const loginUrl = String(obj.login_url || '').trim();
  if (!email || !loginUrl) throw new Error('企业邮箱登录入口响应不完整。');
  if (/emailUpdate\.html/i.test(loginUrl)) {
    throw new Error('企业邮箱返回了"升级客户端"提示页——client-ver 被风控（需 >= 2.0.0.5）。');
  }
  return { email, loginUrl, isNewMail: obj.is_newemail === 1 || obj.is_newemail === '1' };
}

/** 完整 SSO 换登，返回可复用的邮箱会话（sid + cookies）*/
async function bootstrapMailSession() {
  const login = await requestMailLogin();
  const rr = await followBrowserRedirects({ url: login.loginUrl, cookies: [], ua: mailUserAgent() });
  const finalUrl = new URL(rr.finalUrl);
  const sid = readMailSid(rr.html) || finalUrl.searchParams.get('sid') || '';
  if (!sid) throw new Error('企业邮箱首页已打开，但没有解析到 sid。');
  if (rr.cookies.length === 0) throw new Error('企业邮箱 SSO 没有产出可复用 cookie。');
  return {
    email: login.email,
    accountName: login.email.split('@')[0] || '',
    domain: login.email.split('@')[1] || '',
    origin: finalUrl.origin,
    appName: finalUrl.pathname.split('/').filter(Boolean)[0] || 'js6',
    finalUrl: rr.finalUrl,
    sid,
    clientVersion: MAIL_CLIENT_VERSION,
    isNewMail: login.isNewMail,
    cookies: rr.cookies,
    updatedAt: Date.now(),
  };
}

// ── wmsvr 业务客户端 ────────────────────────────────────────

class MailWmsvrError extends Error {
  constructor(func, response) {
    const code = typeof response.code === 'string' ? response.code : '';
    super(`企业邮箱接口 ${func} 失败${code ? `（${code}）` : ''}：${response.msg || ''}`);
    this.name = 'MailWmsvrError';
    this.code = code;
  }
}
function isMailSessionError(error) {
  return error instanceof MailWmsvrError && (error.code === 'FA_INVALID_SESSION' || error.code === 'FA_SECURITY');
}

function createMailClient(session) {
  const finalUrl = new URL(session.finalUrl);
  const appName = session.appName || finalUrl.pathname.split('/').filter(Boolean)[0] || 'js6';
  let cookies = session.cookies;

  async function callWmsvr(func, body) {
    const url = new URL(`${session.origin || finalUrl.origin}/${appName}/s`);
    url.searchParams.set('sid', session.sid);
    url.searchParams.set('func', func);
    const cookieHeader = buildCookieHeader(cookies, url);
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        Accept: 'text/javascript',
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookieHeader,
        'User-Agent': mailUserAgent(),
      },
      body: `var=${encodeURIComponent(serializeMailBody(body))}`,
    });
    cookies = mergeCookies(cookies, extractCookiesFromResponse(response, url));
    if (!response.ok) throw new Error(`企业邮箱接口 ${func} 请求失败：HTTP ${response.status}`);
    const parsed = parseLooseMailResponse(await response.text());
    if ((typeof parsed.code === 'string' ? parsed.code : '') !== S_OK) throw new MailWmsvrError(func, parsed);
    return parsed;
  }

  return {
    callWmsvr,

    async getAllFolders() {
      const r = await callWmsvr('mbox:getAllFolders', {});
      return (Array.isArray(r.var) ? r.var : []).map((f) => ({
        id: Number(f.id),
        name: String(f.name || ''),
        parent: Number(f.parent || 0),
        messageCount: Number(f.stats?.messageCount || 0),
        unreadMessageCount: Number(f.stats?.unreadMessageCount || 0),
        system: Boolean(f.flags?.system),
      })).filter((f) => Number.isFinite(f.id));
    },

    async listMessages(folderId, limit = 20, descending = true) {
      const r = await callWmsvr('mbox:listMessages', {
        fid: Number(folderId),
        limit,
        returnTotal: true,
        order: 'date',
        desc: descending === true,
      });
      return Array.isArray(r.var) ? r.var : [];
    },

    async getMessageInfos(ids) {
      if (!ids || ids.length === 0) return [];
      const r = await callWmsvr('mbox:getMessageInfos', { ids });
      return Array.isArray(r.var) ? r.var : [];
    },

    async readMessage(id) {
      const r = await callWmsvr('mbox:readMessage', {
        id: String(id),
        header: true,
        returnImageInfo: true,
        returnAntispamInfo: true,
        autoName: true,
        supportTNEF: true,
      });
      return r.var;
    },

    /**
     * 拉正文（Coremail 正文是独立 part，不在 wmsvr）。
     * @param {string} mid 邮件 id
     * @param {string} part 正文 part id（readMessage 的 html.id / text.id）
     * @param {'text'|'html'} mode
     */
    async readMessageBody(mid, part, mode = 'text') {
      const url = new URL(`${session.origin || finalUrl.origin}/${appName}/read/readhtml.jsp`);
      url.searchParams.set('sid', session.sid);
      url.searchParams.set('mid', String(mid));
      url.searchParams.set('part', String(part));
      url.searchParams.set('mode', mode);
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: { Cookie: buildCookieHeader(cookies, url), 'User-Agent': mailUserAgent() },
      });
      if (!response.ok) return '';
      return response.text();
    },

    async searchMessagesBySubject(subject, limit = 20) {
      const r = await callWmsvr('mbox:searchMessages', {
        fid: SENT_FOLDER_ID,
        conditions: [{ field: 'subject', operator: 'contains', operand: subject }],
        limit,
      });
      return Array.isArray(r.var)
        ? r.var.map((x) => (typeof x === 'string' ? x : x && (x.mid ?? x.id))).filter(Boolean).map(String)
        : [];
    },

    async initCompose() {
      const init = await callWmsvr('mbox:compose', {});
      const composeId = typeof init.var === 'string' ? init.var.trim() : '';
      if (!composeId) throw new Error('企业邮箱 compose 初始化没有返回 compose id。');
      const infoResult = await callWmsvr('mbox:getComposeInfo', { id: composeId });
      const info = ensureRecord(infoResult.var);
      return {
        id: String(info.id || composeId),
        account: String(info.account || session.email),
        saveSentCopy: info.saveSentCopy !== false,
      };
    },

    async uploadAttachment(composeId, filePath) {
      const resolved = resolveSafeFile(filePath);
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) throw new Error(`邮件附件必须是普通文件：${resolved}`);
      const filename = path.basename(resolved);
      const contentType = inferContentType(filename);
      const file = new File([fs.readFileSync(resolved)], filename, { type: contentType });
      const form = new FormData();
      form.append('Filedata', file, filename);
      const url = new URL(`${session.origin || finalUrl.origin}/${appName}/compose/upload.jsp`);
      url.searchParams.set('sid', session.sid);
      url.searchParams.set('composeId', composeId);
      url.searchParams.set('type', 'native');
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { Cookie: buildCookieHeader(cookies, url), 'User-Agent': mailUserAgent() },
        body: form,
      });
      if (!response.ok) throw new Error(`企业邮箱附件上传失败：HTTP ${response.status}`);
      const parsed = parseLooseMailResponse(await response.text());
      if ((typeof parsed.code === 'string' ? parsed.code : '') !== S_OK) throw new MailWmsvrError('compose/upload.jsp', parsed);
      return { name: filename, size: stat.size, contentType, attachId: readUploadAttachmentId(parsed) };
    },

    async sendMail(params) {
      const r = await callWmsvr('mbox:compose', {
        riskHitIntercept: MAIL_SEND_PROFILE.riskHitIntercept,
        id: params.composeId,
        attrs: {
          account: params.account,
          showOneRcpt: false,
          to: params.to,
          cc: params.cc ?? [],
          bcc: params.bcc ?? [],
          subject: params.subject,
          isHtml: params.isHtml === true,
          content: params.content,
          priority: params.priority ?? 3,
          requestReadReceipt: false,
          saveSentCopy: MAIL_SEND_PROFILE.saveSentCopy,
        },
        returnInfo: MAIL_SEND_PROFILE.returnInfo,
        action: MAIL_SEND_PROFILE.action,
      });
      return {
        tid: typeof r.tid === 'string' ? r.tid.trim() : null,
        raw: r,
        sendProfile: MAIL_SEND_PROFILE,
      };
    },

    async recallMessage(mid) {
      const r = await callWmsvr('mbox:recallMessage', { mid: String(mid) });
      const result = ensureRecord(r.var);
      return {
        mid: String(mid),
        results: ensureRecord(result.recallresult),
        code: r.code,
      };
    },
  };
}

module.exports = {
  MAIL_CLIENT_VERSION,
  SENT_FOLDER_ID,
  MAIL_SEND_PROFILE,
  bootstrapMailSession,
  createMailClient,
  isMailSessionError,
  serializeMailBody,
  readMailSid,
};
