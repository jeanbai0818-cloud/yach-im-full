/**
 * 会议室 cookie 会话缓存
 * 存于 session.json 同目录下的 meeting-room-session.json（chmod 600, gitignored）。
 * 路径解析复用主 session 的候选优先级（env YACH_STATE_DIR / 本机开发路径）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { candidatePaths } = require('../../../auth/session');

/** 会议室 session 文件路径（与主 session 同目录）*/
function meetingRoomSessionPath() {
  const primary = candidatePaths()[0];
  return path.join(path.dirname(primary), 'meeting-room-session.json');
}

/** 返回所有候选路径（读取时依次尝试）*/
function meetingRoomSessionCandidates() {
  return candidatePaths().map((p) => path.join(path.dirname(p), 'meeting-room-session.json'));
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
  for (const p of meetingRoomSessionCandidates()) {
    try {
      if (p && fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (isValidSession(parsed)) return parsed;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

function writeStoredMeetingRoomSession(session) {
  const p = meetingRoomSessionPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = `${p}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(session, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, p);
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    /* best effort */
  }
  return p;
}

function clearStoredMeetingRoomSession() {
  let cleared = false;
  for (const p of meetingRoomSessionCandidates()) {
    try {
      if (p && fs.existsSync(p)) {
        fs.unlinkSync(p);
        cleared = true;
      }
    } catch {
      /* ignore */
    }
  }
  return cleared;
}

module.exports = {
  meetingRoomSessionPath,
  readStoredMeetingRoomSession,
  writeStoredMeetingRoomSession,
  clearStoredMeetingRoomSession,
};
