/**
 * OKR Bearer token 缓存（独立于知音楼主 token）
 * 存于主 session 同目录 okr-session.json（chmod 600, gitignored）。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { candidatePaths } = require('../../../auth/session');

function okrSessionPath() {
  return path.join(path.dirname(candidatePaths()[0]), 'okr-session.json');
}
function okrSessionCandidates() {
  return candidatePaths().map((p) => path.join(path.dirname(p), 'okr-session.json'));
}

function isValid(v) {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.accessToken === 'string' &&
    typeof v.workcode === 'string' &&
    typeof v.cid === 'string' &&
    typeof v.expiresAt === 'number'
  );
}

function readStoredOkrSession() {
  for (const p of okrSessionCandidates()) {
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

function writeStoredOkrSession(session) {
  const p = okrSessionPath();
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

module.exports = { okrSessionPath, readStoredOkrSession, writeStoredOkrSession };
