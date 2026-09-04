/**
 * 会议室 Cookie 会话仅保存在当前 Gateway 进程内。
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

function isValidSession(v) {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.sessionId === 'string' &&
    typeof v.userId === 'string' &&
    Array.isArray(v.cookies) &&
    typeof v.updatedAt === 'number'
  );
}

function readStoredMeetingRoomSession() {
  return isValidSession(sessionCache) ? cloneSession(sessionCache) : null;
}

function writeStoredMeetingRoomSession(session) {
  if (!isValidSession(session)) throw new Error('会议室会话格式无效。');
  sessionCache = cloneSession(session);
  return 'memory://yach-im-full/meeting-room-session';
}

function clearStoredMeetingRoomSession() {
  const cleared = Boolean(sessionCache);
  sessionCache = null;
  return cleared;
}

module.exports = {
  readStoredMeetingRoomSession,
  writeStoredMeetingRoomSession,
  clearStoredMeetingRoomSession,
};
