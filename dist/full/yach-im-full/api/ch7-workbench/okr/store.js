/** OKR Bearer token cache in the yach-im-full-owned OpenClaw plugin state. */
'use strict';

const OKR_SESSION_KEY = 'default';
const OKR_SESSION_LOCATION = 'openclaw-state://plugin/yach-im-full/okr-session/default';
let okrSessionStore = null;

function configureOkrSessionStore(store) {
  if (!store || typeof store.lookup !== 'function' || typeof store.register !== 'function') {
    throw new TypeError('yach-im-full OKR 需要 OpenClaw plugin-state store（lookup/register）。');
  }
  okrSessionStore = store;
  return store;
}

function clearOkrSessionStore() {
  okrSessionStore = null;
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
  if (!okrSessionStore) return null;
  const value = okrSessionStore.lookup(OKR_SESSION_KEY);
  return isValid(value) ? JSON.parse(JSON.stringify(value)) : null;
}

function writeStoredOkrSession(session) {
  if (!okrSessionStore) {
    throw new Error('yach-im-full OKR 尚未连接 OpenClaw plugin-state store；请先启动 Gateway。');
  }
  if (!isValid(session)) throw new Error('OKR session 格式无效。');
  okrSessionStore.register(OKR_SESSION_KEY, JSON.parse(JSON.stringify(session)));
  return OKR_SESSION_LOCATION;
}

module.exports = {
  OKR_SESSION_KEY,
  OKR_SESSION_LOCATION,
  clearOkrSessionStore,
  configureOkrSessionStore,
  readStoredOkrSession,
  writeStoredOkrSession,
};
