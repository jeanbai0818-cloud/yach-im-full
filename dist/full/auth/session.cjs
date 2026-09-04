/** yach-im-full 专属登录态存储。 */
'use strict';

// Credentials are persisted by OpenClaw's plugin-state store. The plugin never
// reads a shared session file, browser profile, keychain, or another app's data.
const SESSION_KEY = 'default';
const SESSION_LOCATION = 'openclaw-state://plugin/yach-im-full/nim-session/default';

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

function configureSessionStore(store) {
  if (!store || typeof store.lookup !== 'function' || typeof store.register !== 'function') {
    throw new TypeError('yach-im-full 需要 OpenClaw plugin-state store（lookup/register）。');
  }
  sessionStore = store;
  return store;
}

function clearSessionStore() {
  sessionStore = null;
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
    throw new Error('yach-im-full 尚未连接 OpenClaw plugin-state store；请先启动 Gateway。');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('yach-im-full 登录态必须是 JSON 对象。');
  }
  sessionStore.register(SESSION_KEY, cloneJson(data));
}

function resolvedSessionPath() {
  if (!sessionStore || !sessionStore.lookup(SESSION_KEY)) return null;
  return SESSION_LOCATION;
}

module.exports = {
  SESSION_KEY,
  SESSION_LOCATION,
  clearSessionStore,
  configureSessionStore,
  loadSession,
  saveSession,
  resolvedSessionPath,
};
