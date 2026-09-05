/** OKR Bearer token cache in a yach-im-full-owned private state file. */
'use strict';

const path = require('node:path');
const {
  STATE_DIR,
  createJsonKeyedFileStore,
} = require('../../../../auth/session.cjs');

const OKR_SESSION_KEY = 'default';
const DEFAULT_OKR_SESSION_PATH = path.join(STATE_DIR, 'okr-session.json');
let okrSessionStore = null;
let okrSessionLocation = DEFAULT_OKR_SESSION_PATH;

function configureOkrSessionStore(store) {
  if (!store || typeof store.lookup !== 'function' || typeof store.register !== 'function') {
    throw new TypeError('yach-im-full OKR 需要可用的专属换票态存储（lookup/register）。');
  }
  okrSessionStore = store;
  if (typeof store.location === 'string' && store.location) okrSessionLocation = store.location;
  return store;
}

function configureFileOkrSessionStore(file = DEFAULT_OKR_SESSION_PATH) {
  okrSessionLocation = path.resolve(file);
  return configureOkrSessionStore(createJsonKeyedFileStore(okrSessionLocation, OKR_SESSION_KEY));
}

function clearOkrSessionStore() {
  okrSessionStore = null;
  okrSessionLocation = DEFAULT_OKR_SESSION_PATH;
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
    throw new Error('yach-im-full OKR 专属换票态存储尚未初始化。');
  }
  if (!isValid(session)) throw new Error('OKR session 格式无效。');
  okrSessionStore.register(OKR_SESSION_KEY, JSON.parse(JSON.stringify(session)));
  return okrSessionLocation;
}

module.exports = {
  DEFAULT_OKR_SESSION_PATH,
  OKR_SESSION_KEY,
  clearOkrSessionStore,
  configureOkrSessionStore,
  configureFileOkrSessionStore,
  readStoredOkrSession,
  writeStoredOkrSession,
};
