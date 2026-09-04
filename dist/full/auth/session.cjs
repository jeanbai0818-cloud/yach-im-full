/** yach-im-full 专属登录态存储。 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const EMPTY_SESSION = {
  token: '',
  accesstoken: '',
  uid: '',
  workcode: '',
  deptid: '',
  cloudtoken: '',
  user: {},
};

function candidatePaths() {
  const paths = [];
  if (process.env.YACH_IM_FULL_SESSION_PATH) paths.push(path.resolve(process.env.YACH_IM_FULL_SESSION_PATH));
  if (process.env.YACH_IM_FULL_STATE_DIR) {
    paths.push(path.join(process.env.YACH_IM_FULL_STATE_DIR, 'sessions', 'session.json'));
  } else if (!paths.length) {
    paths.push(path.join(os.homedir(), '.openclaw', 'workspace-yach-im-full', 'sessions', 'session.json'));
  }
  const openClawSession = process.env.YACH_IM_FULL_OPENCLAW_SESSION_PATH
    ? path.resolve(process.env.YACH_IM_FULL_OPENCLAW_SESSION_PATH)
    : process.env.YACH_IM_FULL_STATE_DIR
      ? path.join(path.dirname(process.env.YACH_IM_FULL_STATE_DIR), 'sessions', 'session.json')
      : path.join(os.homedir(), '.openclaw', 'sessions', 'session.json');
  if (!paths.includes(openClawSession)) paths.push(openClawSession);
  return paths;
}

function loadSession() {
  const paths = candidatePaths();
  for (const [index, file] of paths.entries()) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      // The shared OpenClaw session is a compatibility source for NIM only.
      // Never hand its HTTP/CAPI credentials or unrelated fields to this plugin.
      if (index > 0) {
        return {
          cloudtoken: typeof parsed?.cloudtoken === 'string' ? parsed.cloudtoken : '',
          user: {
            id: parsed?.user?.id == null ? '' : String(parsed.user.id),
            name: typeof parsed?.user?.name === 'string' ? parsed.user.name : '',
            name_nick: typeof parsed?.user?.name_nick === 'string' ? parsed.user.name_nick : '',
          },
        };
      }
      return parsed;
    } catch (error) {
      throw new Error(`yach-im-full session 文件损坏或不可读：${file}（${error.message}）`);
    }
  }
  return { ...EMPTY_SESSION, user: {} };
}

function saveSession(data) {
  const file = candidatePaths()[0];
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try { fs.chmodSync(path.dirname(file), 0o700); } catch {}
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temp, file);
    fs.chmodSync(file, 0o600);
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function resolvedSessionPath() {
  return candidatePaths().find((file) => fs.existsSync(file)) || null;
}

module.exports = { candidatePaths, loadSession, saveSession, resolvedSessionPath };
