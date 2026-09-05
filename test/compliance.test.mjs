import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const manifest = JSON.parse(await fs.readFile(new URL("../openclaw.plugin.json", import.meta.url), "utf8"));
const { fullTools, optionalToolNames, sideEffectingToolNames } = await import("../dist/full/full-tools.js");
const { registerFullRuntime } = await import("../dist/full-runtime.js");
const { resolveYachAccount, inspectYachAccount } = await import("../dist/config.js");

test("manifest declares every optional runtime tool and its side-effect status", () => {
  const contractNames = new Set(manifest.contracts.tools);
  const metadata = manifest.toolMetadata ?? {};
  assert.equal(fullTools.length, contractNames.size);
  assert.deepEqual(new Set(Object.keys(metadata)), optionalToolNames);
  for (const name of optionalToolNames) {
    assert.ok(contractNames.has(name), `${name} must remain in contracts.tools`);
    assert.equal(metadata[name].optional, true, `${name} must be optional in the manifest`);
    assert.equal(metadata[name].sideEffecting ?? false, sideEffectingToolNames.has(name));
  }
});

test("tool-discovery registers tools only and never starts NIM or Gateway routes", () => {
  const calls = { tools: [], services: 0, commands: 0, routes: 0, hooks: 0 };
  registerFullRuntime({
    registrationMode: "tool-discovery",
    registerTool(tool, options) { calls.tools.push({ name: tool.name, options }); },
    registerService() { calls.services += 1; },
    registerCommand() { calls.commands += 1; },
    registerHttpRoute() { calls.routes += 1; },
    on() { calls.hooks += 1; },
  });
  assert.equal(calls.tools.length, 284);
  assert.equal(calls.services, 0);
  assert.equal(calls.commands, 0);
  assert.equal(calls.routes, 0);
  assert.equal(calls.hooks, 0);
  assert.equal(calls.tools.filter(({ options }) => options?.optional === true).length, optionalToolNames.size);
});

test("full runtime asks for approval before Yach external side effects", async () => {
  const hooks = [];
  const calls = { tools: [], services: [], commands: [], routes: [] };
  registerFullRuntime({
    registrationMode: "full",
    registerTool(tool, options) { calls.tools.push({ name: tool.name, options }); },
    registerService(service) { calls.services.push(service.id); },
    registerCommand(command) { calls.commands.push(command.name); },
    registerHttpRoute(route) { calls.routes.push(route.path); },
    on(event, handler) { hooks.push({ event, handler }); },
  });
  assert.deepEqual(calls.services, ["yach-im-full-nim"]);
  assert.equal(calls.tools.length, 284);
  const beforeToolCall = hooks.find((entry) => entry.event === "before_tool_call")?.handler;
  assert.equal(typeof beforeToolCall, "function");
  assert.ok((await beforeToolCall({ toolName: "yach_send_message", params: {} }))?.requireApproval);
  assert.equal(await beforeToolCall({ toolName: "yach_get_status", params: {} }), undefined);
  assert.ok((await beforeToolCall({
    toolName: "message",
    params: { channel: "yach-im-full", action: "send" },
  }))?.requireApproval);
});

test("setup entry is bundled and does not import the full channel runtime", async () => {
  const entry = (await import("../dist/setup-entry.js")).default;
  assert.equal(entry.kind, "bundled-channel-setup-entry");
  const setupPlugin = entry.loadSetupPlugin();
  assert.equal(setupPlugin.id, "yach-im-full");
  assert.equal(typeof setupPlugin.setupContract, "object");
  assert.equal(typeof setupPlugin.config.resolveAccount, "function");
});

test("account policy resolution is fail-closed and audit-safe", () => {
  const cfg = {
    channels: {
      "yach-im-full": {
        appKey: "test-app-key",
        appSecret: "test-app-secret",
      },
    },
  };
  const account = resolveYachAccount(cfg, "default");
  assert.equal(account.groupPolicy, "allowlist");
  assert.equal(account.dmPolicy, "pairing");
  const inspected = inspectYachAccount(cfg, "default");
  assert.equal(inspected.config.groupPolicy, undefined);
  assert.equal(inspected.appKey, "[configured]");
  assert.equal(inspected.appSecret, "[configured]");
  assert.equal(inspected.config.appKey, "[configured]");
  assert.equal(inspected.config.appSecret, "[configured]");
});

test("inbound dispatch uses the official channel ingress resolver", async () => {
  const source = await fs.readFile(new URL("../dist/inbound-dispatch.js", import.meta.url), "utf8");
  assert.match(source, /resolveStableChannelMessageIngress/);
  assert.doesNotMatch(source, /channelIngress:\s*["']unsupported["']/);
});
