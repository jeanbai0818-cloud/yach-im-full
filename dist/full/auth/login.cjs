/**
 * 知音楼扫码登录。
 *
 * 这是纯二维码轮询流程：公共接口取得 randstr，手机扫码确认后返回
 * Authorization/access token/user 信息，再补 cloudtoken 给 NIM 使用。
 */
'use strict';

const os = require('node:os');
const path = require('node:path');
const { post, postPublic, getPublic } = require('./request.cjs');
const { loadSession, saveSession } = require('./session.cjs');

const QR_BASE_URL = 'https://yach.zhiyinlou.com/?from=qrcode&type=4&random=';
const QR_EXPIRE_MS = 60_000;
const QR_POLL_INTERVAL_MS = 2_000;

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function pick(sources, keys) {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
  }
  return '';
}

function collectSources(payload) {
  const root = asObject(payload);
  if (!root) return [];
  const sources = [];
  const seen = new Set();
  const keys = ['obj', 'data', 'result', 'user_info', 'userInfo', 'user', 'account_info', 'company_list'];
  function visit(value, depth = 0) {
    const record = asObject(value);
    if (!record || seen.has(record)) return;
    seen.add(record);
    if (depth < 3) for (const key of keys) visit(record[key], depth + 1);
    sources.push(record);
  }
  visit(root);
  return sources;
}

function normalizeSession(payload) {
  const sources = collectSources(payload);
  const token = pick(sources, ['r_o_token', 'ro_token', 'roToken', 'jwttoken', 'token']);
  const accesstoken = pick(sources, ['access_token', 'accesstoken', 'accessToken']);
  const workcode = pick(sources, ['work_code', 'workcode', 'workCode']);
  const deptid = pick(sources, ['dept_id', 'deptid', 'deptId']);
  const cloudtoken = pick(sources, ['cloudtoken', 'cloudToken']);
  const userId = pick(sources, ['id', 'uid', 'user_id', 'userId']);
  const name = pick(sources, ['name_nick', 'nickname', 'name', 'real_name', 'userName']) || '知音楼用户';
  const avatarUrl = pick(sources, ['avatar', 'avatarUrl', 'avatar_url', 'headImg', 'head_img']);
  const session = {
    token,
    accesstoken,
    uid: userId,
    workcode,
    deptid,
    cloudtoken,
    cp_id: pick(sources, ['cp_id', 'cpId']) || '1',
    tokenUpdatedAt: token ? Date.now() : 0,
    user: { id: userId, name },
  };
  if (avatarUrl) session.user.avatarUrl = avatarUrl;
  return session;
}

function resolveOpenClawTempRoot() {
  const fs = require('node:fs');
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  const fallback = path.join(os.tmpdir(), uid === undefined ? 'openclaw' : `openclaw-${uid}`);
  const preferred = process.platform === 'win32' ? fallback : '/tmp/openclaw';
  const ensureSafe = (dir) => {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`临时媒体目录不安全：${dir}`);
    if (uid !== undefined && typeof stat.uid === 'number' && stat.uid !== uid) throw new Error(`临时媒体目录不属于当前用户：${dir}`);
    try { fs.chmodSync(dir, 0o700); } catch {}
    fs.accessSync(dir, fs.constants.W_OK | fs.constants.X_OK);
    return dir;
  };
  try { return ensureSafe(preferred); } catch (error) {
    if (preferred === fallback) throw error;
    return ensureSafe(fallback);
  }
}

async function generateQrImage(url) {
  const QRCode = require('qrcode');
  const fs = require('node:fs');
  const dir = path.join(resolveOpenClawTempRoot(), 'yach-im-full-login');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `yach-qr-${process.pid}-${Date.now()}.png`);
  await QRCode.toFile(file, url, { type: 'png', width: 360, margin: 2 });
  return file;
}

async function getQrRandstr(postFn = postPublic) {
  const response = await postFn('94capi/ucenter/qrcode/randstr/save', {});
  if (response.code !== 200 || !response.obj?.randstr) throw new Error(`二维码生成失败: code=${response.code} msg=${response.msg}`);
  return response.obj.randstr;
}

function classifyQrResponse(response) {
  const code = response?.code;
  const msg = String(response?.msg || response?.message || '');
  if (code === 10035 || /(过期|失效|超时)/.test(msg)) return { status: 'expired', raw: response };
  const scanned = /(已扫码|已扫描|待确认|确认登录|请确认|待授权|扫码成功)/.test(msg);
  const confirmed = /(授权成功|登录成功|确认成功|扫码登录成功|登录完成|已确认|已登录)/.test(msg);
  const session = normalizeSession(response);
  const hasSession = Boolean(session.token && (session.user.id || session.workcode || session.cloudtoken));
  if (hasSession) return { status: 'confirmed', session, raw: response };
  if (code === 200 || confirmed) return { status: 'confirmed_pending', raw: response };
  return { status: scanned ? 'scanned' : 'waiting', raw: response };
}

async function pollQrStatus(randstr, getFn = getPublic) {
  return classifyQrResponse(await getFn('usergroup/qrcode/user/get', { randstr }));
}

async function login(options = {}) {
  const {
    onQr,
    onStatus,
    onPoll,
    onDone,
    timeout = QR_EXPIRE_MS,
    merge = true,
    maxPollErrors = 5,
  } = options;
  const getRandstr = options.getQrRandstrFn || getQrRandstr;
  const pollStatus = options.pollQrStatusFn || pollQrStatus;
  const renderQr = options.generateQrImageFn || generateQrImage;
  const wait = options.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = Date.now() + Math.min(QR_EXPIRE_MS, Math.max(1, Number(timeout) || QR_EXPIRE_MS));
  const randstr = await getRandstr();
  const url = `${QR_BASE_URL}${randstr}`;
  const imgPath = await renderQr(url);
  if (onQr) await onQr({ url, imgPath, count: 1 });

  let scanned = false;
  let errors = 0;
  let lastError = null;
  let lastResponse = null;
  while (Date.now() < deadline) {
    await wait(QR_POLL_INTERVAL_MS);
    if (Date.now() >= deadline) break;
    let result;
    try {
      result = await pollStatus(randstr);
      errors = 0;
      lastError = null;
    } catch (error) {
      errors += 1;
      lastError = error;
      if (errors >= Math.max(1, Number(maxPollErrors) || 5)) throw new Error(`二维码状态连续查询失败 ${errors} 次：${error.message || error}`);
      continue;
    }
    lastResponse = result.raw;
    try { onPoll?.(result.raw); } catch {}
    if (result.status === 'expired') {
      await onStatus?.('expired');
      throw new Error('二维码已过期，请重新执行 /yach_login');
    }
    if (result.status === 'scanned' || result.status === 'confirmed_pending') {
      if (!scanned) {
        scanned = true;
        await onStatus?.(result.status, result.status === 'scanned' ? '手机已扫码，请在手机上点击「确认登录」' : '手机已确认，正在等待登录凭证');
      }
      continue;
    }
    if (result.status !== 'confirmed') continue;

    const session = result.session;
    if (!session.cloudtoken) {
      try {
        // 二维码响应还未写入磁盘，续 cloudtoken 时必须用刚拿到的
        // Authorization，而不是可能已失效的旧 session。
        const refreshed = await post('usergroup/account/refresh/token', {}, () => session);
        if (refreshed.code === 200 && refreshed.obj?.cloudtoken) {
          session.cloudtoken = refreshed.obj.cloudtoken;
          if (refreshed.obj.id && !session.user.id) session.user.id = String(refreshed.obj.id);
        }
      } catch {}
    }
    let finalSession = session;
    if (merge) {
      let old = null;
      try { old = loadSession(); } catch {}
      if (old?.token) finalSession = { ...old, ...session, user: { ...(old.user || {}), ...session.user } };
    }
    saveSession(finalSession);
    await onStatus?.('confirmed', '登录成功');
    await onDone?.(finalSession);
    return finalSession;
  }
  const detail = lastResponse ? `；最后响应 code=${lastResponse.code ?? '-'} msg=${lastResponse.msg ?? lastResponse.message ?? '-'}` : '';
  const errorDetail = lastError ? `；最后错误=${lastError.message || lastError}` : '';
  throw new Error(`二维码已过期或未在 60 秒内完成扫码确认，请重新执行 /yach_login${detail}${errorDetail}`);
}

module.exports = {
  QR_BASE_URL,
  classifyQrResponse,
  generateQrImage,
  getQrRandstr,
  login,
  normalizeSession,
  pollQrStatus,
  resolveOpenClawTempRoot,
};
