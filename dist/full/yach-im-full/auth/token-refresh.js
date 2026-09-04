/**
 * 知音楼 HTTP 登录 Token 续期。
 *
 * 桌面端会在登录态仍有效时调用 94capi/ucenter/user/refresh/token，
 * 用返回的 obj.jwttoken 替换 Authorization Token。插件运行在服务器或
 * 虚拟机时也必须完成同一条纯 HTTP 流程，不能依赖桌面端或浏览器。
 */
'use strict';

const { post } = require('../utils/request');
const { loadSession, saveSession } = require('./session');

const REFRESH_TOKEN_PATH = '94capi/ucenter/user/refresh/token';

function ensureRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function readString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isLoggedOutResponse(value) {
  const response = ensureRecord(value);
  return Number(response.code || 0) === 401 || /ERR_TOKEN_LOGOUT/i.test(readString(response.msg));
}

async function refreshSessionToken(options = {}) {
  const postFn = options.postFn || post;
  const loadSessionFn = options.loadSessionFn || loadSession;
  const saveSessionFn = options.saveSessionFn || saveSession;
  const response = ensureRecord(await postFn(REFRESH_TOKEN_PATH, {}));
  const object = ensureRecord(response.obj);
  const token = readString(object.jwttoken || object.r_o_token || object.token);

  if (Number(response.code || 0) !== 200 || !token) {
    const reason = readString(response.msg) || `code=${response.code ?? 'unknown'}`;
    const error = new Error(
      isLoggedOutResponse(response)
        ? '知音楼登录已失效，请在当前 OpenClaw 实例执行 /yach-login 重新扫码。'
        : `知音楼 Token 续期失败：${reason}`,
    );
    error.code = isLoggedOutResponse(response) ? 'YACH_LOGIN_REQUIRED' : 'YACH_TOKEN_REFRESH_FAILED';
    error.responseCode = response.code;
    throw error;
  }

  const current = ensureRecord(loadSessionFn());
  const user = ensureRecord(current.user);
  const next = {
    ...current,
    token,
    tokenUpdatedAt: Date.now(),
    user: {
      ...user,
      ...ensureRecord(object.user_info),
    },
  };
  saveSessionFn(next);
  return next;
}

module.exports = {
  REFRESH_TOKEN_PATH,
  refreshSessionToken,
  isLoggedOutResponse,
};
