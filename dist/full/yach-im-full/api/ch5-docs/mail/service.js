/**
 * 企业邮箱业务编排：列文件夹 / 列邮件 / 读详情 / 发文本邮件
 *
 * 会话失效（sid/cookie 过期或 FA_INVALID_SESSION/FA_SECURITY）自动重新 SSO 换登重试。
 * 逻辑参照旧插件 yach-omni-2.1.5 mail-read/mail-send service.js，改写为 CJS。
 */
'use strict';

const { bootstrapMailSession, createMailClient, isMailSessionError } = require('./client');
const { readStoredMailSession, writeStoredMailSession } = require('./store');

const SESSION_TTL_MS = 30 * 60 * 1000; // sid 大约 30min 有效，超时先重登

function ensureRecord(v) {
  return v && typeof v === 'object' ? v : {};
}
function addrText(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) return field.map(addrText).filter(Boolean).join(', ');
  const f = ensureRecord(field);
  const name = String(f.name || f.personal || '').trim();
  const email = String(f.email || f.address || f.addr || '').trim();
  if (name && email) return `${name} <${email}>`;
  return email || name;
}
function tsToStr(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  const ms = n < 1e12 ? n * 1000 : n;
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function normalizeMessage(raw) {
  const v = ensureRecord(raw);
  const sourceId = v.mid ?? v.id;
  const messageId = typeof sourceId === 'string' ? sourceId.trim() : String(sourceId || '');
  if (!messageId) return null;
  return {
    messageId,
    folderId: Number(v.fid) || 0,
    from: addrText(v.from),
    to: addrText(v.to),
    cc: addrText(v.cc),
    subject: String(v.subject || ''),
    sentAt: tsToStr(v.sentDate),
    receivedAt: tsToStr(v.receivedDate),
    flags: v.flags || {},
    attachmentCount: Array.isArray(v.attachments) ? v.attachments.length : 0,
  };
}

// ── 会话生命周期 ────────────────────────────────────────────

function isFresh(session) {
  return session && session.sid && Date.now() - (session.updatedAt || 0) < SESSION_TTL_MS;
}

async function ensureSession(output) {
  const existing = readStoredMailSession();
  if (isFresh(existing)) return existing;
  output && output('mail: 正在通过登录态换取企业邮箱 SSO...');
  const session = await bootstrapMailSession();
  writeStoredMailSession(session);
  return session;
}

async function withMail(task, output, mediaContext) {
  let session = await ensureSession(output);
  try {
    return await task(createMailClient(session, mediaContext), session);
  } catch (error) {
    if (!isMailSessionError(error)) throw error;
    output && output('mail: 邮箱会话已失效，正在重新 SSO 换登后重试...');
    session = await bootstrapMailSession();
    writeStoredMailSession(session);
    return task(createMailClient(session, mediaContext), session);
  }
}

// ── 对外能力 ────────────────────────────────────────────────

async function listMailFolders(opts = {}) {
  return withMail(async (client, session) => {
    const folders = await client.getAllFolders();
    return { email: session.email, folders };
  }, opts.output);
}

/** 列某文件夹的邮件（folderId 默认 1=收件箱）*/
async function listMailMessages(opts = {}) {
  const folderId = Number(opts.folderId ?? 1);
  const limit = Math.min(Math.max(Number(opts.limit ?? 20), 1), 100);
  return withMail(async (client, session) => {
    const raw = await client.listMessages(folderId, limit, true);
    // listMessages 常只返回 id 列表 / 精简对象；用 getMessageInfos 补全
    let messages = raw.map(normalizeMessage).filter(Boolean);
    const needInfo = messages.length === 0 && raw.length > 0;
    if (needInfo || messages.some((m) => !m.subject && !m.from)) {
      const ids = raw.map((x) => (typeof x === 'string' ? x : x && x.id)).filter(Boolean).slice(0, limit);
      const infos = await client.getMessageInfos(ids);
      messages = infos.map(normalizeMessage).filter(Boolean);
    }
    return { email: session.email, folderId, returned: messages.length, messages };
  }, opts.output);
}

/** 读单封邮件详情（含正文）*/
async function readMailMessage(opts = {}) {
  const messageId = String(opts.messageId || '').trim();
  if (!messageId) throw new Error('messageId 不能为空。');
  return withMail(async (client) => {
    const v = ensureRecord(await client.readMessage(messageId));
    // readMessage 返回的 text/html 是正文 part 元信息（content 为空），
    //   真正正文需用 part id 另外拉 /js6/read/readhtml.jsp。
    const htmlPart = ensureRecord(v.html);
    const textPart = ensureRecord(v.text);
    let raw = '';
    try {
      if (htmlPart.id) raw = await client.readMessageBody(messageId, htmlPart.id, 'text');
      if (!raw && textPart.id) raw = await client.readMessageBody(messageId, textPart.id, 'text');
    } catch {
      /* 拿不到正文就只给头 */
    }
    const content = String(raw || '')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      messageId,
      folderId: Number(v.fid) || 0,
      from: addrText(v.from),
      to: addrText(v.to),
      cc: addrText(v.cc),
      subject: String(v.subject || ''),
      sentAt: tsToStr(v.sentDate),
      priority: v.priority,
      attachmentCount: Array.isArray(v.attachments) ? v.attachments.length : 0,
      content: content.slice(0, 8000),
      hasHtml: Boolean(htmlPart.id),
    };
  }, opts.output);
}

/**
 * 发文本邮件（写操作）
 * @param {object} params { to:string[]|string, subject, content, cc?, bcc?, attachments?:string[], output? }
 */
async function sendMailText(params = {}, mediaContext) {
  const toList = Array.isArray(params.to) ? params.to : String(params.to || '').split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
  if (toList.length === 0) throw new Error('收件人不能为空。');
  const subject = String(params.subject || '').trim();
  if (!subject) throw new Error('邮件主题不能为空。');
  const ccList = Array.isArray(params.cc) ? params.cc : String(params.cc || '').split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
  const bccList = Array.isArray(params.bcc) ? params.bcc : String(params.bcc || '').split(/[;,\n]/).map((s) => s.trim()).filter(Boolean);
  const attachments = Array.isArray(params.attachments)
    ? params.attachments
    : String(params.attachments || '').split(/[;\n]/).map((s) => s.trim()).filter(Boolean);

  return withMail(async (client, session) => {
    const compose = await client.initCompose();
    const uploaded = [];
    for (const filePath of attachments) {
      uploaded.push(await client.uploadAttachment(compose.id, filePath));
    }
    let sentBefore = [];
    try {
      sentBefore = await client.searchMessagesBySubject(subject, 50);
    } catch {
      // 发送能力不应被只读基线查询阻断；验证结果会标记为非差集模式。
    }
    const beforeIds = new Set(sentBefore.map(String));

    const result = await client.sendMail({
      composeId: compose.id,
      account: compose.account,
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject,
      content: String(params.content || ''),
      isHtml: false,
      saveSentCopy: true,
    });

    // 发送后在 fid=3（已发送）按主题轮询，并要求出现发送前不存在的新 mid。
    let verified = false;
    let verifiedMessageId = '';
    if (params.verify !== false) {
      for (let i = 0; i < 5 && !verified; i += 1) {
        try {
          const hits = await client.searchMessagesBySubject(subject, 20);
          const fresh = hits.find((id) => !beforeIds.has(String(id)));
          if (fresh) {
            verified = true;
            verifiedMessageId = String(fresh);
          }
        } catch {
          /* 搜索失败不阻断结果 */
        }
        if (!verified) await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return {
      account: session.email,
      to: toList,
      cc: ccList,
      subject,
      tid: result.tid,
      accepted: Boolean(result.tid),
      verified,
      verifiedMessageId,
      uploadedAttachments: uploaded,
      debug: {
        action: result.sendProfile.action,
        riskHitIntercept: result.sendProfile.riskHitIntercept,
        returnInfo: result.sendProfile.returnInfo,
        saveSentCopy: result.sendProfile.saveSentCopy,
        sentFolderId: 3,
        baselineCount: sentBefore.length,
      },
      message: result.tid
        ? verified
          ? '邮件已发送并验证到位。'
          : '邮件已发送（未在已发送搜到，可能有延迟）。'
        : '邮件已提交，但未拿到投递 tid。',
    };
  }, params.output, mediaContext);
}

function normalizeRecallResults(results) {
  return Object.entries(ensureRecord(results)).map(([email, rawCode]) => {
    const code = Number(rawCode);
    return {
      email,
      code: Number.isFinite(code) ? code : rawCode,
      success: code === 2,
      status: code === 2 ? '已撤回' : code === 0 ? '撤回失败（对方可能已读）' : '状态未知',
    };
  });
}

async function recallMail(opts = {}) {
  const messageId = String(opts.messageId || opts.mid || '').trim();
  if (!messageId) throw new Error('messageId 不能为空。');
  return withMail(async (client) => {
    const response = await client.recallMessage(messageId);
    const results = normalizeRecallResults(response.results);
    return {
      messageId,
      results,
      allSucceeded: results.length > 0 && results.every((item) => item.success),
      message: results.length
        ? results.map((item) => `${item.email}: ${item.status} (code=${item.code})`).join('\n')
        : '服务器接受了撤回请求，但没有返回收件人结果。',
    };
  }, opts.output);
}

module.exports = {
  listMailFolders,
  listMailMessages,
  readMailMessage,
  sendMailText,
  recallMail,
  normalizeRecallResults,
};
