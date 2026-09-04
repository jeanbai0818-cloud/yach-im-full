/**
 * 企业邮箱会话缓存（cookies + sid），存主 session 同目录 mail-session.json。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { candidatePaths } = require('../../../auth/session');

function mailSessionPath() {
  return path.join(path.dirname(candidatePaths()[0]), 'mail-session.json');
}
function mailSessionCandidates() {
  return candidatePaths().map((p) => path.join(path.dirname(p), 'mail-session.json'));
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
  for (const p of mailSessionCandidates()) {
    try {
      if (p && fs.existsSync(p)) {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (isValid(parsed)) return parsed;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

function writeStoredMailSession(session) {
  const p = mailSessionPath();
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

module.exports = { mailSessionPath, readStoredMailSession, writeStoredMailSession };
