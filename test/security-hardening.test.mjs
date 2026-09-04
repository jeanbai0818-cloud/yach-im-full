import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);
const payroll = require("../dist/full/yach-im-full/api/ch7-workbench/payroll/index.js");
const attendanceClient = require("../dist/full/yach-im-full/api/ch7-workbench/attendance/client.js");
const attendanceService = require("../dist/full/yach-im-full/api/ch7-workbench/attendance/service.js");
const { yachPunchOnDuty, yachAttendanceAuthCheck } = await import("../dist/full/yach-im-full/plugin/tools/ch25-attendance.js");

test("发布运行时不包含本机工资条凭据抓取路径", async () => {
  const source = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch7-workbench/payroll/index.js"), "utf8");
  assert.doesNotMatch(source, /Cookies\.binarycookies|spawnSync|child_process|extractFromBinaryCookies|process\.env|YACH_IM_FULL_PAYROLL_ADMIN_TOKEN/u);
  assert.equal(typeof payroll.extractFromBinaryCookies, "undefined");
  payroll.configurePayrollToken("");
  try {
    await assert.rejects(() => payroll.refreshPayrollToken(), /payrollAdminToken/u);
  } finally {
    payroll.configurePayrollToken("");
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

test("工资条检查不持久化 token", async () => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 1, iss: "payroll-api.zhiyinlou.com" })).toString("base64url");
  const token = `eyJ.${payload}.sig`;
  payroll.configurePayrollToken(token);
  try {
    const result = await payroll.refreshPayrollToken();
    assert.equal(result.token, "已配置（不回显）");
    assert.equal(payroll.getConfiguredPayrollToken(), token);
  } finally {
    payroll.configurePayrollToken("");
  }
});
