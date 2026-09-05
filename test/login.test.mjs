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

function memoryStore(initial) {
  let value = initial === undefined ? undefined : structuredClone(initial);
  return {
    register(key, next) {
      assert.equal(key, "default");
      value = structuredClone(next);
    },
    lookup(key) {
      assert.equal(key, "default");
      return value === undefined ? undefined : structuredClone(value);
    },
  };
}

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

test("session reader 只使用 yach-im-full 专属私有状态文件", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yach-im-full-state-"));
  const sessionPath = path.join(dir, "nim-session.json");
  sessionApi.configureFileSessionStore(sessionPath);
  try {
    assert.deepEqual(sessionApi.loadSession(), {
      token: "",
      accesstoken: "",
      uid: "",
      workcode: "",
      deptid: "",
      cloudtoken: "",
      user: {},
    });
    assert.equal(sessionApi.resolvedSessionPath(), null);
    assert.equal(sessionApi.DEFAULT_SESSION_PATH.endsWith("/.openclaw/yach-im-full/state/nim-session.json"), true);
    assert.equal(sessionApi.resolvedSessionPath(), null);
  } finally {
    sessionApi.clearSessionStore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("session reader 不回退到共享 session、环境变量或其他插件", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yach-im-full-state-"));
  const sessionPath = path.join(dir, "nim-session.json");
  sessionApi.configureFileSessionStore(sessionPath);
  const oldValues = {
    sessionPath: process.env.YACH_IM_FULL_SESSION_PATH,
    stateDir: process.env.YACH_IM_FULL_STATE_DIR,
    openClawPath: process.env.YACH_IM_FULL_OPENCLAW_SESSION_PATH,
  };
  process.env.YACH_IM_FULL_SESSION_PATH = "/tmp/not-read/session.json";
  process.env.YACH_IM_FULL_STATE_DIR = "/tmp/not-read";
  process.env.YACH_IM_FULL_OPENCLAW_SESSION_PATH = "/tmp/not-read/shared.json";
  try {
    assert.equal(sessionApi.loadSession().cloudtoken, "");
    sessionApi.saveSession({ cloudtoken: "plugin-token", user: { id: "438470" } });
    assert.equal(sessionApi.loadSession().cloudtoken, "plugin-token");
    assert.equal(sessionApi.resolvedSessionPath(), sessionPath);
    assert.equal(fs.statSync(sessionPath).mode & 0o777, 0o600);
  } finally {
    for (const [key, value] of Object.entries(oldValues)) {
      const envKey = key === "sessionPath" ? "YACH_IM_FULL_SESSION_PATH" : key === "stateDir" ? "YACH_IM_FULL_STATE_DIR" : "YACH_IM_FULL_OPENCLAW_SESSION_PATH";
      if (value === undefined) delete process.env[envKey];
      else process.env[envKey] = value;
    }
    sessionApi.clearSessionStore();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("二维码状态 code=200 但没有凭证时仍保持 pending", () => {
  const result = loginApi.classifyQrResponse({ code: 200, msg: "确认成功", obj: {} });
  assert.equal(result.status, "confirmed_pending");
  assert.equal(result.session, undefined);
});

test("登录成功后保存 API token、NIM cloudtoken 和 user.id", async () => {
  sessionApi.configureSessionStore(memoryStore());
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yach-im-full-login-"));
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
    assert.deepEqual(sessionApi.loadSession(), session);
  } finally {
    sessionApi.clearSessionStore();
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
