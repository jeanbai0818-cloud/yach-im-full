import { fullTools, sideEffectingToolNames } from "../dist/full/full-tools.js";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { NimListener } = require("../dist/full/nim/nim-listener.cjs");
const nimBridge = require("../dist/full/nim-bridge.cjs");
const { loadSession } = require("../dist/full/auth/session.cjs");

const SELF = "438470";
const INVALID = "__yach_im_full_read_smoke_invalid_20260904__";
const SKIP = new Map([
  ["yach_prepare_weekly_send", "生成一次性提交 token，保留给人工审阅流程"],
  ["yach_refresh_payroll_token", "检查受控工资条凭据，保留给人工审阅流程"],
  ["yach_refresh_tencent_token", "会刷新本地腾讯会议 token 缓存"],
  ["yach_attendance_auth_check", "会换取并缓存考勤访问凭据，保留给人工审阅流程"],
]);

function scalarFor(name, schema = {}) {
  const key = String(name).toLowerCase();
  if (key.includes("sessionid")) return `p2p:${SELF}`;
  if (key === "userid" || key.endsWith("userid")) return SELF;
  if (key.includes("userids") || key.includes("accids")) return [SELF];
  if (key.includes("url")) return "https://example.invalid/yach-im-full-read-smoke";
  if (key.includes("filepath") || key.includes("path")) return "/tmp/yach-im-full-read-smoke-not-found";
  if (key.includes("query") || key.includes("keyword") || key.includes("name")) return INVALID;
  if (key.includes("date")) return "2000-01-01";
  if (key.includes("time")) return 1;
  if (key === "scene") return "p2p";
  if (schema.enum?.length) return schema.enum[0];
  return INVALID;
}

function valueFor(name, schema, required) {
  if (!schema || typeof schema !== "object") return INVALID;
  if (schema.default !== undefined && !required) return schema.default;
  if (schema.anyOf?.length) return valueFor(name, schema.anyOf[0], required);
  if (schema.oneOf?.length) return valueFor(name, schema.oneOf[0], required);
  if (schema.type === "array") {
    if (!required && /^(group|team|user|ids|list|orders)/iu.test(name)) return [];
    return [valueFor(name, schema.items ?? { type: "string" }, true)];
  }
  if (schema.type === "boolean") return false;
  if (schema.type === "integer" || schema.type === "number") {
    return schema.minimum !== undefined ? schema.minimum : 1;
  }
  if (schema.type === "object") return {};
  return scalarFor(name, schema);
}

function safeArgs(tool) {
  const schema = tool.parameters ?? {};
  const required = new Set(schema.required ?? []);
  const args = {};
  for (const [name, property] of Object.entries(schema.properties ?? {})) {
    if (required.has(name) || ["limit", "page", "pagesize", "offset"].includes(name)) {
      args[name] = valueFor(name, property, required.has(name));
    }
  }
  return args;
}

function safeError(error) {
  return String(error?.message ?? error)
    .replace(/https?:\/\/\S+/gi, "<url>")
    .replace(/(token|authorization|cloudtoken|accesstoken)[^\s]*/gi, "$1=<redacted>")
    .replace(/\b\d{12,}\b/g, "<id>")
    .slice(0, 300);
}

function logger() {
  return {
    info() {},
    warn(message) { process.stderr.write(`WARN ${safeError(message)}\n`); },
    error(message) { process.stderr.write(`ERROR ${safeError(message)}\n`); },
    debug() {},
  };
}

function waitForConnect(listener, timeoutMs = 25_000) {
  if (listener.isConnected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`NIM connect timeout after ${timeoutMs}ms`)), timeoutMs);
    const onConnect = () => { clearTimeout(timer); listener.removeListener("disconnect", onDisconnect); resolve(); };
    const onDisconnect = (error) => { clearTimeout(timer); listener.removeListener("connect", onConnect); reject(error); };
    listener.once("connect", onConnect);
    listener.once("disconnect", onDisconnect);
  });
}

const session = loadSession();
if (String(session?.user?.id) !== SELF || !session?.cloudtoken) {
  throw new Error("full read smoke requires yach-im-full session with user.id/cloudtoken");
}

const listener = new NimListener({ logger: logger(), sessionLoader: loadSession });
nimBridge.setActiveListener(listener);
listener.on("error", (error) => process.stderr.write(`NIM_ERROR ${safeError(error)}\n`));
listener.start();

try {
  await waitForConnect(listener);
  const results = [];
  for (const tool of fullTools) {
    if (sideEffectingToolNames.has(tool.name)) {
      results.push({ name: tool.name, status: "approval-only" });
      continue;
    }
    if (SKIP.has(tool.name)) {
      results.push({ name: tool.name, status: "safe-skip", reason: SKIP.get(tool.name) });
      continue;
    }
    const started = Date.now();
    try {
      await Promise.race([
        tool.execute("full-read-smoke", safeArgs(tool)),
        new Promise((_, reject) => setTimeout(() => reject(new Error("tool timeout after 15s")), 15_000)),
      ]);
      results.push({ name: tool.name, status: "returned", ms: Date.now() - started });
    } catch (error) {
      results.push({ name: tool.name, status: "controlled-error", ms: Date.now() - started, error: safeError(error) });
    }
  }
  const counts = Object.fromEntries([...new Set(results.map((result) => result.status))]
    .map((status) => [status, results.filter((result) => result.status === status).length]));
  process.stdout.write(`${JSON.stringify({ accountId: SELF, connected: listener.isConnected, toolCount: fullTools.length, counts, results }, null, 2)}\n`);
} finally {
  nimBridge.clearActiveListener(listener);
  listener.destroy();
}
