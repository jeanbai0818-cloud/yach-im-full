import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);
const attendanceClient = require("../dist/full/yach-im-full/api/ch7-workbench/attendance/client.js");
const attendanceService = require("../dist/full/yach-im-full/api/ch7-workbench/attendance/service.js");
const { yachPunchOnDuty, yachAttendanceAuthCheck } = await import("../dist/full/yach-im-full/plugin/tools/ch25-attendance.js");

test("工资条能力已从发布运行时、工具注册和 manifest 完整移除", async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "openclaw.plugin.json"), "utf8"));
  const { fullTools } = await import("../dist/full/full-tools.js");
  assert.equal(fullTools.some((tool) => /payroll|payslip/iu.test(tool.name)), false);
  assert.doesNotMatch(JSON.stringify(manifest), /payroll|payslip|工资条/iu);
  await assert.rejects(
    import("../dist/full/yach-im-full/api/ch7-workbench/payroll/index.js"),
    /Cannot find module|ERR_MODULE_NOT_FOUND/u,
  );
  const workbench = require("../dist/full/yach-im-full/api/ch7-workbench/index.js");
  assert.equal(workbench.getPayroll, undefined);
  assert.equal(workbench.getPayslip, undefined);
});

test("登录态只使用 yach-im-full 自己的 OpenClaw plugin-state", async () => {
  const source = await fs.readFile(path.join(root, "dist/full/auth/session.cjs"), "utf8");
  assert.doesNotMatch(source, /node:(?:fs|os|path)|readFileSync|writeFileSync|session\.json|YACH_IM_FULL_(?:SESSION|STATE|OPENCLAW)/u);
  assert.match(source, /plugin-state/u);
  const sessionApi = require("../dist/full/auth/session.cjs");
  const values = new Map();
  sessionApi.configureSessionStore({
    register(key, value) { values.set(key, structuredClone(value)); },
    lookup(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
  });
  try {
    sessionApi.saveSession({ token: "api", cloudtoken: "nim", user: { id: "438470" } });
    assert.equal(values.has("default"), true);
    assert.equal(sessionApi.loadSession().cloudtoken, "nim");
    assert.match(sessionApi.resolvedSessionPath(), /^openclaw-state:\/\/plugin\/yach-im-full\//u);
  } finally {
    sessionApi.clearSessionStore();
  }
});

test("OKR 换票态只使用 yach-im-full 自己的 OpenClaw plugin-state", async () => {
  const source = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch7-workbench/okr/store.js"), "utf8");
  assert.doesNotMatch(source, /node:(?:fs|os|path)|readFileSync|writeFileSync|okr-session\.json|session\.json/u);
  assert.match(source, /plugin-state/u);
  const okrStore = require("../dist/full/yach-im-full/api/ch7-workbench/okr/store.js");
  const values = new Map();
  okrStore.configureOkrSessionStore({
    register(key, value) { values.set(key, structuredClone(value)); },
    lookup(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
  });
  const session = {
    accessToken: "okr-token",
    workcode: "332776",
    cid: "cid-test",
    expiresAt: Date.now() + 60_000,
  };
  try {
    assert.equal(okrStore.readStoredOkrSession(), null);
    assert.equal(okrStore.writeStoredOkrSession(session), "openclaw-state://plugin/yach-im-full/okr-session/default");
    assert.deepEqual(okrStore.readStoredOkrSession(), session);
  } finally {
    okrStore.clearOkrSessionStore();
  }
});

test("考勤只接受调用方显式坐标和设备标识", async () => {
  const clientSource = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch7-workbench/attendance/client.js"), "utf8");
  const serviceSource = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch7-workbench/attendance/service.js"), "utf8");
  assert.doesNotMatch(clientSource, /randomGeoAround|fakeOfficeGeo|machine-id|os\.hostname|FAKE_/u);
  assert.doesNotMatch(serviceSource, /randomGeoAround|fakeOfficeGeo|machine-id|os\.hostname|FAKE_|office-seed/u);
  assert.deepEqual(yachPunchOnDuty.parameters.required, ["latitude", "longitude", "deviceId", "deviceName"]);
  assert.deepEqual(yachAttendanceAuthCheck.parameters.required, ["latitude", "longitude", "deviceId", "deviceName"]);
  assert.doesNotMatch(serviceSource, /attendance-auth\.json|writeFileSync|readFileSync|mkdirSync/u);
  assert.throws(
    () => attendanceClient.buildYachHeaders({ token: "t", workcode: "w" }, "test"),
    /deviceId 和 deviceName/u,
  );
  await assert.rejects(() => attendanceService.getAttendanceAuthContext(), /longitude/u);
});

test("辅助系统会话只在进程内缓存，不写本机 Cookie/token 文件", async () => {
  const meetingStore = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch4-collab/meeting-room/store.js"), "utf8");
  const mailStore = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch5-docs/mail/store.js"), "utf8");
  const intelloft = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch36-intelloft/index.js"), "utf8");
  assert.doesNotMatch(meetingStore, /writeFileSync|readFileSync|meeting-room-session\.json/u);
  assert.doesNotMatch(mailStore, /writeFileSync|readFileSync|mail-session\.json/u);
  assert.doesNotMatch(intelloft, /h5-token\.json|readFileSync\(tokenPath|writeFileSync\(tmp/u);
});
