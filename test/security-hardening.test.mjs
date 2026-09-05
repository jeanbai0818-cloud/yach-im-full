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

test("登录态只使用 yach-im-full 自己的私有状态文件", async () => {
  const source = await fs.readFile(path.join(root, "dist/full/auth/session.cjs"), "utf8");
  assert.match(source, /node:fs/u);
  assert.match(source, /\.openclaw.*yach-im-full.*state/u);
  assert.match(source, /nim-session\.json/u);
  assert.doesNotMatch(source, /YACH_IM_FULL_(?:SESSION|STATE|OPENCLAW)|haoweilai-agent|browser|keychain|Cookies\.binarycookies/u);
  const sessionApi = require("../dist/full/auth/session.cjs");
  const tempDir = await fs.mkdtemp(path.join(root, ".tmp-session-"));
  const sessionPath = path.join(tempDir, "nim-session.json");
  sessionApi.configureFileSessionStore(sessionPath);
  try {
    sessionApi.saveSession({ token: "api", cloudtoken: "nim", user: { id: "438470" } });
    assert.equal(sessionApi.loadSession().cloudtoken, "nim");
    assert.equal(sessionApi.resolvedSessionPath(), sessionPath);
    assert.equal((await fs.stat(sessionPath)).mode & 0o777, 0o600);
  } finally {
    sessionApi.clearSessionStore();
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

test("OKR 换票态只使用 yach-im-full 自己的私有状态文件", async () => {
  const source = await fs.readFile(path.join(root, "dist/full/yach-im-full/api/ch7-workbench/okr/store.js"), "utf8");
  assert.match(source, /okr-session\.json/u);
  assert.doesNotMatch(source, /haoweilai-agent|browser|keychain|Cookies\.binarycookies/u);
  const okrStore = require("../dist/full/yach-im-full/api/ch7-workbench/okr/store.js");
  const tempDir = await fs.mkdtemp(path.join(root, ".tmp-okr-"));
  const okrPath = path.join(tempDir, "okr-session.json");
  okrStore.configureFileOkrSessionStore(okrPath);
  const session = {
    accessToken: "okr-token",
    workcode: "332776",
    cid: "cid-test",
    expiresAt: Date.now() + 60_000,
  };
  try {
    assert.equal(okrStore.readStoredOkrSession(), null);
    assert.equal(okrStore.writeStoredOkrSession(session), okrPath);
    assert.deepEqual(okrStore.readStoredOkrSession(), session);
    assert.equal((await fs.stat(okrPath)).mode & 0o777, 0o600);
  } finally {
    okrStore.clearOkrSessionStore();
    await fs.rm(tempDir, { recursive: true, force: true });
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

test("媒体上传统一使用 OpenClaw Agent 媒体访问策略", async () => {
  const mediaModules = [
    "dist/outbound.js",
    "dist/full/yach-im-full/api/ch1-messaging/index.js",
    "dist/full/yach-im-full/api/ch5-docs/index.js",
    "dist/full/yach-im-full/api/ch5-docs/mail/client.js",
    "dist/full/yach-im-full/utils/cos-upload.js",
    "dist/full/yach-im-full/api/ch36-intelloft/index.js",
  ];
  for (const relativePath of mediaModules) {
    const source = await fs.readFile(path.join(root, relativePath), "utf8");
    assert.doesNotMatch(source, /resolveSafeFile|readFileSync|statSync|node:fs\/promises/u, relativePath);
  }

  const { readAuthorizedMediaFile } = require("../dist/full/yach-im-full/utils/media-access.js");
  const tempDir = await fs.mkdtemp(path.join(root, ".tmp-media-"));
  const outsideDir = await fs.mkdtemp(path.join(root, ".tmp-media-outside-"));
  const insidePath = path.join(tempDir, "inside.txt");
  const outsidePath = path.join(outsideDir, "outside.txt");
  await fs.writeFile(insidePath, "authorized media");
  await fs.writeFile(outsidePath, "outside media");
  const context = {
    config: {},
    agentId: "main",
    workspaceDir: tempDir,
    fsPolicy: { root: tempDir },
  };
  try {
    const media = await readAuthorizedMediaFile(insidePath, context);
    assert.equal(media.name, "inside.txt");
    assert.equal(media.size, Buffer.byteLength("authorized media"));
    assert.equal(media.buffer.toString(), "authorized media");
    await assert.rejects(
      () => readAuthorizedMediaFile(outsidePath, context),
      /not in|不在|outside|root|allowed|授权/u,
    );
    await assert.rejects(
      () => readAuthorizedMediaFile(insidePath),
      /OpenClaw|上下文/u,
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.rm(outsideDir, { recursive: true, force: true });
  }
});
