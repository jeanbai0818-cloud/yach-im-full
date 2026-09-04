import test from "node:test";
import assert from "node:assert/strict";

test("full entry registers the yach-im-full channel, NIM service, tools, and commands", async () => {
  const entry = (await import("../dist/index.js")).default;
  const commands = [];
  const services = [];
  const channels = [];
  const tools = [];
  const stores = new Map();
  const runtime = {
    state: {
      openSyncKeyedStore({ namespace }) {
        if (!stores.has(namespace)) stores.set(namespace, new Map());
        const values = stores.get(namespace);
        return {
          register(key, value) { values.set(key, structuredClone(value)); },
          lookup(key) { return values.has(key) ? structuredClone(values.get(key)) : undefined; },
        };
      },
    },
  };
  entry.register({
    registrationMode: "full",
    runtime,
    registerChannel(channel) { channels.push(channel); },
    registerService(service) { services.push(service.id); },
    registerCommand(command) { commands.push(command.name); },
    registerTool(tool) { tools.push(tool.name); },
  });
  assert.equal(channels.length, 1);
  assert.equal(channels[0].plugin.id, "yach-im-full");
  assert.deepEqual(services, ["yach-im-full-nim"]);
  assert.deepEqual(commands, [
    "yach_login", "yach_status", "yach-refresh-token", "yach-response",
  ]);
  assert.equal(tools.length, 284);
  assert.equal(new Set(tools).size, 284);
});
