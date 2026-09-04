/**
 * NIM WebSocket 客户端封装
 *
 * 已验证（2026-07-12）：
 *   - account = userInfo.id（不是 uuid！）
 *   - token   = cloudtoken
 *   - appKey  = c3edf5f1f69d9bf76a4373508915a257
 *   - server  = weblink-haoweilai.netease.im:443
 */

// ── 浏览器环境 mock（必须在 require SDK 之前）──────────────
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://localhost/', pretendToBeVisual: true,
});
const browserGlobalKeys = [
  'window', 'document', 'navigator', 'self', 'location',
  'localStorage', 'XMLHttpRequest', 'FormData',
];
const previousBrowserGlobals = new Map(
  browserGlobalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(global, key)]),
);
let browserGlobalsInstalled = false;

// ── XHR 补丁：SDK 上传文件走 XMLHttpRequest ──────────────────
// jsdom 的 XHR 有同源限制；xmlhttprequest-ssl 没有 CORS 但只接受 string/Buffer
// 补一层：给 xhr.upload 加 stub + 拦截 send 把 Blob 转 Buffer
const { XMLHttpRequest: NodeXHR } = require('xmlhttprequest-ssl');
function PatchedXHR() {
  const xhr = new NodeXHR();
  if (!xhr.upload) { try { xhr.upload = { onprogress: null, addEventListener(){}, removeEventListener(){} }; } catch {} }
  const origSend = xhr.send.bind(xhr);
  xhr.send = function(body) {
    if (body && typeof body === 'object' && typeof body.arrayBuffer === 'function') {
      body.arrayBuffer().then(ab => origSend(Buffer.from(ab))).catch(e => { if (xhr.onerror) xhr.onerror(e); });
      return;
    }
    return origSend(body);
  };
  return xhr;
}
// Node 原生 Blob
const { Blob } = require('buffer');
const installedBrowserGlobals = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  self: dom.window,
  location: dom.window.location,
  localStorage: dom.window.localStorage,
  XMLHttpRequest: PatchedXHR,
  FormData: dom.window.FormData,
};

function installBrowserGlobals() {
  if (browserGlobalsInstalled) return;
  for (const [key, value] of Object.entries(installedBrowserGlobals)) {
    Object.defineProperty(global, key, { configurable: true, writable: true, value });
  }
  global.window.XMLHttpRequest = PatchedXHR;
  global.window.Blob = Blob;
  browserGlobalsInstalled = true;
}

function restoreGlobals() {
  if (!browserGlobalsInstalled) return;
  for (const [key, value] of Object.entries(installedBrowserGlobals)) {
    if (global[key] !== value) continue;
    const descriptor = previousBrowserGlobals.get(key);
    if (descriptor) Object.defineProperty(global, key, descriptor);
    else delete global[key];
  }
  browserGlobalsInstalled = false;
}

// SDK 的文件上传/发送是在连接建立后异步调用的；模块加载阶段的浏览器
// mock 已经恢复，故媒体操作必须覆盖完整的 Promise/callback 生命周期。
// 用引用计数支持并发的图片/文件发送，避免一个请求结束时提前恢复全局环境。
let asyncBrowserGlobalsUsers = 0;

async function withBrowserGlobalsAsync(fn) {
  installBrowserGlobals();
  asyncBrowserGlobalsUsers += 1;
  try {
    return await fn();
  } finally {
    asyncBrowserGlobalsUsers -= 1;
    if (asyncBrowserGlobalsUsers === 0) restoreGlobals();
  }
}

installBrowserGlobals();
// ────────────────────────────────────────────────────────────

const NIMSDK = require('@yxim/nim-web-sdk');
const NIM = NIMSDK.NIM;
restoreGlobals();
const { loadSession } = require('../auth/session');

const NIM_APPKEY = 'c3edf5f1f69d9bf76a4373508915a257';
const NIM_LBS_URL = 'https://weblink-haoweilai.netease.im:443';
const CONNECT_TIMEOUT_MS = 15_000;

let _nim = null;
let _connecting = null;
let nimBrowserGlobalsHeld = false;

/**
 * 获取（或创建）NIM 单例，连接成功后 resolve
 */
function getNim() {
  const runtime = require('./runtime');
  const runtimeNim = runtime.getActiveNim();
  if (runtimeNim) return Promise.resolve(runtimeNim);
  if (runtime.hasActiveListener()) return runtime.waitForActiveNim(CONNECT_TIMEOUT_MS);
  if (_nim) return Promise.resolve(_nim);
  if (_connecting) return _connecting;
  installBrowserGlobals();
  _connecting = new Promise((resolve, reject) => {
    const session = loadSession();
    const account = String(session.user.id);   // 当前登录用户的顶层 user.id
    const token   = session.cloudtoken;        // cloudtoken = NIM token

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { nim.destroy({ done() {} }); } catch {}
      nimBrowserGlobalsHeld = false;
      restoreGlobals();
      reject(new Error(`NIM connect timeout after ${CONNECT_TIMEOUT_MS}ms`));
    }, CONNECT_TIMEOUT_MS);
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const nim = (() => {
      installBrowserGlobals();
      try {
        return NIM.getInstance({
      appKey:  NIM_APPKEY,
      account, token,
      db:    false,
      privateConf: { lbsUrls: [NIM_LBS_URL] },
      syncSessionUnread: false,
      syncRoamingMsgs:   false,
      autoMarkRead:      false,
      debug:  false,
      onconnect() {
        _nim = nim;
        finish(resolve, nim);
      },
      ondisconnect(err) {
        _nim = null;
        restoreGlobals();
        nimBrowserGlobalsHeld = false;
        const msg = err ? `${err.code || ''} ${err.message || ''}` : 'disconnected';
        finish(reject, new Error('NIM disconnect: ' + msg));
      },
      onerror(err) {
        const msg = err ? `${err.code || ''} ${err.message || ''}` : 'error';
        console.error('[NIM] error:', msg);
      },
        });
      } catch (error) {
        restoreGlobals();
        nimBrowserGlobalsHeld = false;
        throw error;
      }
    })();
    nimBrowserGlobalsHeld = true;
  }).finally(() => {
    _connecting = null;
    if (!_nim) {
      nimBrowserGlobalsHeld = false;
      restoreGlobals();
    }
  });
  return _connecting;
}

/**
 * 销毁 NIM 连接
 */
function destroyNim() {
  if (_nim) { _nim.destroy(); _nim = null; }
  nimBrowserGlobalsHeld = false;
  restoreGlobals();
}

module.exports = { getNim, destroyNim, NIM_APPKEY, withBrowserGlobalsAsync };
