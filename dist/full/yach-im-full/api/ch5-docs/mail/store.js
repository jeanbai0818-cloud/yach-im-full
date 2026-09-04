/**
 * 企业邮箱会话仅保存在当前 Gateway 进程内。
 * 不读取浏览器 Cookie，不创建本地会话文件；Gateway 重启后按需重新完成受控 SSO。
 */
'use strict';

let sessionCache = null;

function cloneSession(session) {
  if (!session || typeof session !== 'object') return null;
  return {
    ...session,
    cookies: Array.isArray(session.cookies)
      ? session.cookies.map((cookie) => ({ ...cookie }))
      : [],
  };
}
function isValid(v) {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.sid === 'string' &&
    typeof v.email === 'string' &&
    Array.isArray(v.cookies) &&
    typeof v.updatedAt === 'number'
  );
}

function readStoredMailSession() {
  return isValid(sessionCache) ? cloneSession(sessionCache) : null;
}

function writeStoredMailSession(session) {
  if (!isValid(session)) throw new Error('企业邮箱会话格式无效。');
  sessionCache = cloneSession(session);
  return 'memory://yach-im-full/mail-session';
}

module.exports = { readStoredMailSession, writeStoredMailSession };
