/**
 * yach-im-full 的第二条长连接：网易云信 NIM WebSocket。
 *
 * Channel SDK 和 NIM SDK 完全独立。这里仅负责连接、重连和把实时消息
 * 以 EventEmitter 形式交给消息工具、自动响应和状态路由复用。
 */
'use strict';

const EventEmitter = require('node:events');
const { JSDOM } = require('jsdom');
const { XMLHttpRequest: NodeXHR } = require('xmlhttprequest-ssl');
const { loadSession } = require('../auth/session.cjs');

const NIM_APPKEY = 'c3edf5f1f69d9bf76a4373508915a257';
const NIM_LBS_URL = 'https://weblink-haoweilai.netease.im:443';
const RECONNECT_BASE_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;
const QUERY_TIMEOUT_MS = 20_000;
// The bundled NIM SDK rejects getHistoryMsgs requests above 100.
const MAX_HISTORY_LIMIT = 100;
const MESSAGE_DEDUPE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_DEDUPE_ENTRIES = 5_000;

let sdk = null;
let persistentBrowserRestore = null;

function loadNimSdk() {
  if (sdk) return sdk;
  const keys = ['window', 'document', 'navigator', 'self', 'location', 'localStorage', 'XMLHttpRequest', 'FormData'];
  const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'https://localhost/',
    pretendToBeVisual: true,
  });
  function PatchedXHR() {
    const xhr = new NodeXHR();
    if (!xhr.upload) xhr.upload = { onprogress: null, addEventListener() {}, removeEventListener() {} };
    const send = xhr.send.bind(xhr);
    xhr.send = (body) => {
      if (body && typeof body.arrayBuffer === 'function') {
        body.arrayBuffer().then((buffer) => send(Buffer.from(buffer))).catch(() => send(body));
      } else send(body);
    };
    return xhr;
  }
  Object.assign(PatchedXHR, NodeXHR);
  const installed = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    self: dom.window,
    location: dom.window.location,
    localStorage: dom.window.localStorage,
    XMLHttpRequest: PatchedXHR,
    FormData: dom.window.FormData,
  };
  for (const [key, value] of Object.entries(installed)) Object.defineProperty(global, key, { configurable: true, writable: true, value });
  global.window.XMLHttpRequest = PatchedXHR;
  try {
    const loaded = require('@yxim/nim-web-sdk');
    sdk = loaded.NIM || loaded.default || loaded;
  } finally {
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(global, key, descriptor);
      else delete global[key];
    }
  }
  return sdk;
}

function withBrowserGlobals(fn, { keepAlive = false } = {}) {
  // The NIM SDK also reads browser globals from asynchronous login callbacks.
  // Keep the mock installed for the lifetime of the connected client, then
  // restore the Gateway globals in destroy()/reconnect cleanup.
  const keys = ['window', 'document', 'navigator', 'self', 'location', 'localStorage', 'XMLHttpRequest', 'FormData'];
  const previous = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]));
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'https://localhost/', pretendToBeVisual: true });
  function PatchedXHR() {
    const xhr = new NodeXHR();
    if (!xhr.upload) xhr.upload = { onprogress: null, addEventListener() {}, removeEventListener() {} };
    return xhr;
  }
  Object.assign(PatchedXHR, NodeXHR);
  const installed = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    self: dom.window,
    location: dom.window.location,
    localStorage: dom.window.localStorage,
    XMLHttpRequest: PatchedXHR,
    FormData: dom.window.FormData,
  };
  for (const [key, value] of Object.entries(installed)) Object.defineProperty(global, key, { configurable: true, writable: true, value });
  global.window.XMLHttpRequest = PatchedXHR;
  const restore = () => {
    for (const key of keys) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(global, key, descriptor);
      else delete global[key];
    }
  };
  if (keepAlive) {
    persistentBrowserRestore?.();
    persistentBrowserRestore = restore;
    try { return fn(); } catch (error) {
      if (persistentBrowserRestore === restore) persistentBrowserRestore = null;
      restore();
      throw error;
    }
  }
  try { return fn(); } finally { restore(); }
}

function restorePersistentBrowserGlobals() {
  const restore = persistentBrowserRestore;
  persistentBrowserRestore = null;
  restore?.();
}

class NimListener extends EventEmitter {
  constructor({ logger, sessionLoader = loadSession } = {}) {
    super();
    this.logger = logger || console;
    this.sessionLoader = sessionLoader;
    this._nim = null;
    this._connected = false;
    this._destroyed = false;
    this._reconnectTimer = null;
    this._reconnectAttempts = 0;
    this._seen = new Map();
  }

  get isConnected() { return this._connected; }
  get nim() { return this._connected ? this._nim : null; }

  getSessions() {
    return new Promise((resolve, reject) => {
      if (!this._nim || !this._connected) return reject(new Error('NIM 未连接'));
      if (typeof this._nim.getLocalSessions !== 'function') {
        return reject(new Error('当前 NIM SDK 不支持本地会话列表'));
      }
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`getSessions timeout after ${QUERY_TIMEOUT_MS}ms`));
        }
      }, QUERY_TIMEOUT_MS);
      try {
        this._nim.getLocalSessions({
          limit: 100,
          reverse: false,
          done: (error, data) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) return reject(new Error(error.message || String(error)));
            resolve(Array.isArray(data?.sessions) ? data.sessions : []);
          },
        });
      } catch (error) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      }
    });
  }

  getHistory({ sessionId, limit = 100, endTime } = {}) {
    return new Promise((resolve, reject) => {
      if (!this._nim || !this._connected) return reject(new Error('NIM 未连接'));
      const separator = String(sessionId || '').indexOf(':');
      const scene = separator > 0 ? String(sessionId).slice(0, separator) : '';
      const id = separator > 0 ? String(sessionId).slice(separator + 1) : '';
      if (!scene || !id || !['p2p', 'team'].includes(scene)) {
        return reject(new Error('sessionId 格式应为 p2p:<uid> 或 team:<tid>'));
      }
      if (typeof this._nim.getHistoryMsgs !== 'function') {
        return reject(new Error('当前 NIM SDK 不支持云端历史消息'));
      }
      const boundedLimit = Math.max(1, Math.min(MAX_HISTORY_LIMIT, Number(limit) || 100));
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`getHistory timeout after ${QUERY_TIMEOUT_MS}ms`));
        }
      }, QUERY_TIMEOUT_MS);
      try {
        this._nim.getHistoryMsgs({
          scene,
          to: id,
          limit: boundedLimit,
          endTime: Number(endTime) || 0,
          asc: true,
          done: (error, data) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (error) return reject(new Error(error.message || String(error)));
            resolve(Array.isArray(data?.msgs) ? data.msgs : []);
          },
        });
      } catch (error) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          reject(error);
        }
      }
    });
  }

  start() {
    if (this._nim || this._reconnectTimer) return;
    this._destroyed = false;
    this._connect();
  }

  destroy() {
    this._destroyed = true;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    this._seen.clear();
    if (this._nim) {
      try { this._nim.destroy({ done() {} }); } catch {}
      this._nim = null;
    }
    this._connected = false;
    restorePersistentBrowserGlobals();
  }

  _connect() {
    if (this._destroyed) return;
    if (this._nim) {
      try { this._nim.destroy({ done() {} }); } catch {}
      this._nim = null;
    }
    restorePersistentBrowserGlobals();
    let session;
    try { session = this.sessionLoader(); } catch (error) {
      this.emit('error', error);
      this._scheduleReconnect();
      return;
    }
    const account = String(session?.user?.id || '').trim();
    const token = String(session?.cloudtoken || '').trim();
    if (!account || !token) {
      const error = new Error('NIM 需要登录态中的 user.id 和 cloudtoken');
      this.emit('authRequired', error);
      return;
    }
    try {
      const NIM = loadNimSdk();
      this._nim = withBrowserGlobals(() => NIM.getInstance({
        appKey: NIM_APPKEY,
        account,
        token,
        db: false,
        privateConf: { lbsUrls: [NIM_LBS_URL] },
        syncSessionUnread: false,
        syncRoamingMsgs: false,
        autoMarkRead: false,
        onconnect: () => {
          this._connected = true;
          this._reconnectAttempts = 0;
          clearTimeout(this._reconnectTimer);
          this._reconnectTimer = null;
          this.logger.info?.(`[yach-im-full][nim] 已连接 account=${account}`);
          this.emit('connect', { account });
        },
        ondisconnect: (error) => {
          this._connected = false;
          this.emit('disconnect', error);
          this._scheduleReconnect();
        },
        onerror: (error) => this.emit('error', error),
        onmsg: (message) => this._handleMessage(message, { source: 'realtime', account }),
        onteammsg: (message) => this._handleMessage(message, { source: 'realtime', account }),
        onsysmsg: (message) => this.emit('sysmsg', message),
        onroamingmsgs: (payload) => this._handleBatch(payload, 'roaming', account),
        onofflinemsgs: (payload) => this._handleBatch(payload, 'offline', account),
      }), { keepAlive: true });
    } catch (error) {
      this.emit('error', error);
      this._scheduleReconnect();
    }
  }

  _handleBatch(payload, source, account) {
    const messages = Array.isArray(payload) ? payload : payload?.msgs || [];
    for (const message of messages) this._handleMessage(message, { source, account });
  }

  _handleMessage(message, meta) {
    const id = String(message?.idServer || message?.idClient || message?.id || '');
    const now = Date.now();
    for (const [seenId, seenAt] of this._seen) if (now - seenAt > MESSAGE_DEDUPE_TTL_MS) this._seen.delete(seenId);
    if (id && this._seen.has(id)) return;
    if (id) {
      this._seen.set(id, now);
      while (this._seen.size > MAX_DEDUPE_ENTRIES) this._seen.delete(this._seen.keys().next().value);
    }
    this.emit('message', message, meta);
  }

  _scheduleReconnect() {
    if (this._destroyed || this._reconnectTimer) return;
    const delay = Math.min(RECONNECT_BASE_MS * (2 ** this._reconnectAttempts), RECONNECT_MAX_MS);
    this._reconnectAttempts += 1;
    this.logger.warn?.(`[yach-im-full][nim] ${delay / 1000}s 后重连（第 ${this._reconnectAttempts} 次）`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connect();
    }, delay);
  }
}

module.exports = { NIM_APPKEY, NIM_LBS_URL, NimListener, withBrowserGlobals };
