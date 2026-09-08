import test from "node:test";
import assert from "node:assert/strict";
import { Compile } from "typebox/compile";

const { aggregatedTools, legacyToolMapping, getEnabledAggregatedTools, resolveEnabledYachPacks } =
  await import("../dist/full/aggregated-tools.js");
const { fullTools, fullToolNames } = await import("../dist/full/full-tools.js");

test("all legacy tools map exactly once to a bounded aggregate registry", () => {
  assert.equal(Object.keys(legacyToolMapping).length, 284);
  assert.equal(new Set(Object.values(legacyToolMapping).map((entry) => entry.legacyName)).size, 284);
  assert.ok(Object.values(legacyToolMapping).every((entry) => entry.parameterAdapter === "strip_action_identity"));
  assert.ok(aggregatedTools.length >= 30 && aggregatedTools.length <= 35);
  assert.equal(fullTools.length, aggregatedTools.length);
  assert.deepEqual(fullToolNames, aggregatedTools.map((tool) => tool.name));
});

test("tool packs default to messaging and can enable all categories", () => {
  assert.deepEqual([...resolveEnabledYachPacks({})], ["messaging"]);
  assert.ok(getEnabledAggregatedTools({}).every((tool) => tool.yachPack === "messaging"));
  assert.equal(getEnabledAggregatedTools({ channels: { "yach-im-full": { toolPacks: ["all"] } } }).length, aggregatedTools.length);
  assert.equal(getEnabledAggregatedTools({ channels: { "yach-im-full": { toolPacks: ["mail"] } } }).every((tool) => tool.yachPack === "mail"), true);
  assert.equal(getEnabledAggregatedTools({ channels: { "yach-im-full": { toolPacks: ["platform"] } } }).every((tool) => tool.yachPack === "platform"), true);
  assert.equal(getEnabledAggregatedTools({ channels: { "yach-im-full": { toolPacks: [] } } }).length, 0);
});

test("aggregate schemas use finite action branches", () => {
  const chat = aggregatedTools.find((tool) => tool.name === "yach_private_chat");
  assert.ok(chat);
  const schema = JSON.stringify(chat.parameters);
  assert.match(schema, /send_message/u);
  assert.match(schema, /recall_message/u);
  const validator = Compile(chat.parameters);
  assert.equal(validator.Check({ action: "send_message", to: "user-id", content: "hello" }), true);
  assert.equal(validator.Check({ action: "not_a_real_action" }), false);

  const history = aggregatedTools.find((tool) => tool.name === "yach_message_history");
  assert.ok(history);
  const historySchema = JSON.stringify(history.parameters);
  assert.match(historySchema, /groupName/u);
  assert.match(historySchema, /groupTid/u);
  assert.match(historySchema, /userId/u);
  assert.match(history.description, /私聊或群聊/u);
  assert.match(history.description, /时间范围/u);
  assert.match(history.description, /立即使用此工具执行查询/u);
});
