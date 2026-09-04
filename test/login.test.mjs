import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const loginApi = require("../dist/full/auth/login.cjs");
const requestApi = require("../dist/full/auth/request.cjs");
const sessionApi = require("../dist/full/auth/session.cjs");

test("公共登录请求不携带旧 session 凭证", () => {
  const headers = requestApi.buildPublicHeaders("signed", 123, {});
  assert.equal(headers.Authorization, undefined);
  assert.equal(headers.accesstoken, undefined);
  assert.equal(headers.uid, undefined);
  assert.equal(headers.workcode, undefined);
  assert.equal(headers.sign, "signed");
  assert.equal(headers.timestamp, "123");
  assert.equal(headers.os, "mac");
});

test("session reader 只使用 yach-im-full 专属路径", () => {
  const previousSessionPath = process.env.YACH_IM_FULL_SESSION_PATH;
  const previous = process.env.YACH_IM_FULL_STATE_DIR;
  delete process.env.YACH_IM_FULL_SESSION_PATH;
  process.env.YACH_IM_FULL_STATE_DIR = "/tmp/yach-im-full-only-state";
  try {
    const paths = sessionApi.candidatePaths();
    assert.deepEqual(paths, [
      "/tmp/yach-im-full-only-state/sessions/session.json",
      "/tmp/sessions/session.json",
    ]);
    assert.equal(paths.some((file) => /haoweilai-agent|(?:^|[\\/])yach-im(?:[\\/]|$)/u.test(file)), false);
  } finally {
    if (previousSessionPath === undefined) delete process.env.YACH_IM_FULL_SESSION_PATH;
    else process.env.YACH_IM_FULL_SESSION_PATH = previousSessionPath;
    if (previous === undefined) delete process.env.YACH_IM_FULL_STATE_DIR;
    else process.env.YACH_IM_FULL_STATE_DIR = previous;
  }
});

test("session reader 可复用 OpenClaw 共用 session，但新登录仍写入 full 路径", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yach-im-full-shared-session-"));
  const previous = process.env.YACH_IM_FULL_STATE_DIR;
  process.env.YACH_IM_FULL_STATE_DIR = path.join(dir, "yach-im-full");
  const shared = path.join(dir, "sessions", "session.json");
  fs.mkdirSync(path.dirname(shared), { recursive: true });
  fs.writeFileSync(shared, JSON.stringify({
    token: "must-not-cross-boundary",
    accesstoken: "must-not-cross-boundary",
    cloudtoken: "shared-nim-token",
    user: { id: "438470", name: "NIM user" },
    unrelated: "must-not-cross-boundary",
  }));
  try {
    assert.deepEqual(sessionApi.loadSession(), {
      cloudtoken: "shared-nim-token",
      user: { id: "438470", name: "NIM user", name_nick: "" },
    });
    assert.equal(sessionApi.candidatePaths()[0], path.join(dir, "yach-im-full", "sessions", "session.json"));
  } finally {
    if (previous === undefined) delete process.env.YACH_IM_FULL_STATE_DIR;
    else process.env.YACH_IM_FULL_STATE_DIR = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("二维码状态 code=200 但没有凭证时仍保持 pending", () => {
  const result = loginApi.classifyQrResponse({ code: 200, msg: "确认成功", obj: {} });
  assert.equal(result.status, "confirmed_pending");
  assert.equal(result.session, undefined);
});

test("登录成功后保存 API token、NIM cloudtoken 和 user.id", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yach-im-full-login-"));
  const previous = process.env.YACH_IM_FULL_SESSION_PATH;
  process.env.YACH_IM_FULL_SESSION_PATH = path.join(dir, "session.json");
  try {
    const session = await loginApi.login({
      timeout: 10_000,
      getQrRandstrFn: async () => "test-randstr",
      generateQrImageFn: async () => path.join(dir, "qr.png"),
      pollQrStatusFn: async () => ({
        status: "confirmed",
        raw: { code: 200 },
        session: {
          token: "api-token",
          accesstoken: "access-token",
          cloudtoken: "nim-token",
          uid: "1001",
          workcode: "T1001",
          deptid: "10",
          user: { id: "1001", name: "测试用户" },
        },
      }),
      sleepFn: async () => {},
    });
    assert.equal(session.user.id, "1001");
    assert.equal(session.cloudtoken, "nim-token");
    assert.equal(fs.statSync(process.env.YACH_IM_FULL_SESSION_PATH).mode & 0o777, 0o600);
    assert.deepEqual(sessionApi.loadSession(), session);
  } finally {
    if (previous === undefined) delete process.env.YACH_IM_FULL_SESSION_PATH;
    else process.env.YACH_IM_FULL_SESSION_PATH = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("yach_login 二维码会立即通过当前 yach-im-full 会话发送图片", async () => {
  const originalLogin = loginApi.login;
  const calls = [];
  const qrPath = path.join(os.tmpdir(), `yach-im-full-qr-${process.pid}.png`);
  fs.writeFileSync(qrPath, "fake-png");
  loginApi.login = async ({ onQr }) => {
    await onQr({ url: "https://yach.zhiyinlou.com/?from=qrcode&type=4&random=test", imgPath: qrPath });
    return { user: { id: "438470", name: "测试用户" }, cloudtoken: "nim-token" };
  };
  try {
    const handlers = await import(`../dist/full/full-command-handlers.js?qr-regression=${Date.now()}`);
    const api = {
      config: {},
      logger: { info() {}, warn() {}, error() {} },
      runtime: {
        agent: {
          session: {
            getSessionEntry() {
              return { deliveryContext: { channel: "yach-im-full", to: "user:438470", accountId: "default" } };
            },
          },
        },
        channel: {
          outbound: {
            async loadAdapter(channel) {
              calls.push({ type: "loadAdapter", channel });
              return {
                async sendMedia(params) { calls.push({ type: "sendMedia", params }); },
                async sendText(params) { calls.push({ type: "sendText", params }); },
              };
            },
          },
        },
      },
    };
    const result = await handlers.handleLogin(api, { sessionKey: "agent:main:yach-im-full:test", channelId: "yach-im-full" });
    const media = calls.find((call) => call.type === "sendMedia");
    assert.equal(calls[0].channel, "yach-im-full");
    assert.equal(media.params.to, "user:438470");
    assert.equal(media.params.mediaUrl, qrPath);
    assert.deepEqual(media.params.mediaLocalRoots, [path.dirname(qrPath)]);
    assert.match(result.text, /二维码已发送到当前对话/);
  } finally {
    loginApi.login = originalLogin;
    fs.rmSync(qrPath, { force: true });
  }
});
