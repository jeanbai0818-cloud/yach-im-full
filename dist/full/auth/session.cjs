/** yach-im-full 专属登录态存储。 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Community ClawHub plugins do not receive OpenClaw's trusted-only runtime
// state surface. Keep a narrow local boundary instead: this plugin owns fixed,
// private state files and never discovers other files.
const SESSION_KEY = 'default';
const STATE_DIR = path.join(os.homedir(), '.openclaw', 'yach-im-full', 'state');
const DEFAULT_SESSION_PATH = path.join(STATE_DIR, 'nim-session.json');

const EMPTY_SESSION = {
  token: '',
  accesstoken: '',
  uid: '',
  workcode: '',
  deptid: '',
  cloudtoken: '',
  user: {},
};

let sessionStore = null;
let sessionLocation = DEFAULT_SESSION_PATH;

function assertPrivateDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`yach-im-full 状态目录不是安全的私有目录：${dir}`);
  }
  try { fs.chmodSync(dir, 0o700); } catch {}
}

function assertRegularFile(file) {
  let stat;
  try { stat = fs.lstatSync(file); } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`yach-im-full 状态文件不是普通文件：${file}`);
  }
  try { fs.chmodSync(file, 0o600); } catch {}
  return true;
}

function readJson(file) {
  if (!assertRegularFile(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`yach-im-full 登录态文件损坏或不可读：${file}（${error.message}）`);
  }
}

function writeJsonAtomic(file, value) {
  assertPrivateDirectory(path.dirname(file));
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const text = `${JSON.stringify(value, null, 2)}\n`;
  let fd;
  try {
    fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
    fs.writeFileSync(fd, text, 'utf8');
    try { fs.fsyncSync(fd); } catch {}
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(temp, file);
    try { fs.chmodSync(file, 0o600); } catch {}
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

function createJsonKeyedFileStore(file, key = 'default') {
  const resolved = path.resolve(file);
  return {
    lookup(requestedKey) {
      if (requestedKey !== key) return undefined;
      return readJson(resolved);
    },
    register(requestedKey, value) {
      if (requestedKey !== key) throw new Error(`yach-im-full 状态 key 无效：${requestedKey}`);
      writeJsonAtomic(resolved, value);
    },
    location: resolved,
  };
}

function configureFileSessionStore(file = DEFAULT_SESSION_PATH) {
  sessionLocation = path.resolve(file);
  return configureSessionStore(createJsonKeyedFileStore(sessionLocation, SESSION_KEY));
}

function configureSessionStore(store) {
  if (!store || typeof store.lookup !== 'function' || typeof store.register !== 'function') {
    throw new TypeError('yach-im-full 需要可用的专属登录态存储（lookup/register）。');
  }
  sessionStore = store;
  if (typeof store.location === 'string' && store.location) sessionLocation = store.location;
  return store;
}

function clearSessionStore() {
  sessionStore = null;
  sessionLocation = DEFAULT_SESSION_PATH;
}

function emptySession() {
  return { ...EMPTY_SESSION, user: {} };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadSession() {
  if (!sessionStore) return emptySession();
  const value = sessionStore.lookup(SESSION_KEY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptySession();
  return { ...emptySession(), ...cloneJson(value), user: { ...(value.user || {}) } };
}

function saveSession(data) {
  if (!sessionStore) {
    throw new Error('yach-im-full 专属登录态存储尚未初始化。');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('yach-im-full 登录态必须是 JSON 对象。');
  }
  sessionStore.register(SESSION_KEY, cloneJson(data));
}

function resolvedSessionPath() {
  if (!sessionStore || !sessionStore.lookup(SESSION_KEY)) return null;
  return sessionLocation;
}

module.exports = {
  DEFAULT_SESSION_PATH,
  SESSION_KEY,
  STATE_DIR,
  clearSessionStore,
  configureSessionStore,
  configureFileSessionStore,
  createJsonKeyedFileStore,
  loadSession,
  saveSession,
  resolvedSessionPath,
};
