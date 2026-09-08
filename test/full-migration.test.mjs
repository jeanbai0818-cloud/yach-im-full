import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const manifest = JSON.parse(await fs.readFile(path.join(root, "openclaw.plugin.json"), "utf8"));
const capabilityMap = await fs.readFile(path.join(root, "docs/CAPABILITY-MAP.md"), "utf8");
const migrationMap = await fs.readFile(path.join(root, "docs/TOOL-MIGRATION-MAP.md"), "utf8");
const { fullTools, fullToolNames, optionalToolNames, sideEffectingToolNames } =
  await import("../dist/full/full-tools.js");
const { legacyToolMapping } = await import("../dist/full/aggregated-tools.js");

test("public registry exposes aggregate tools while retaining all 284 internal mappings", () => {
  assert.equal(fullTools.length, 30);
  assert.equal(new Set(fullToolNames).size, 30);
  assert.equal(new Set(manifest.contracts.tools).size, 30);
  assert.equal(Object.keys(manifest.toolMetadata ?? {}).length, 30);
  assert.equal(optionalToolNames.size, 30);
  assert.equal(Object.keys(legacyToolMapping).length, 284);
  assert.match(capabilityMap, /Public aggregate tools: \*\*30\*\*/u);
  assert.match(capabilityMap, /Internal legacy capabilities: \*\*284\*\*/u);
  assert.match(migrationMap, /Legacy capabilities mapped: \*\*284\*\*/u);
  for (const tool of fullTools) {
    assert.equal(typeof tool.execute, "function", `${tool.name} must be executable`);
    assert.equal(typeof tool.parameters, "object", `${tool.name} must expose parameters`);
    assert.ok(manifest.contracts.tools.includes(tool.name), `${tool.name} missing from manifest`);
    assert.equal(manifest.toolMetadata[tool.name].optional, true, `${tool.name} must be optional`);
  }
});

test("every side-effecting migrated tool advertises confirmation", () => {
  assert.equal(sideEffectingToolNames.size, 24);
  for (const tool of fullTools.filter((candidate) => sideEffectingToolNames.has(candidate.name))) {
    assert.match(String(tool.description ?? ""), /(确认|授权)/u, `${tool.name} must advertise confirmation`);
    assert.equal(manifest.toolMetadata[tool.name].sideEffecting, true);
  }
});

test("all migrated API modules import without eager network or credential failures", async () => {
  const apiRoot = path.join(root, "dist/full/yach-im-full/api");
  const files = [];
  async function collect(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(file);
      else if (entry.isFile() && entry.name.endsWith(".js")) files.push(file);
    }
  }
  await collect(apiRoot);
  assert.ok(files.length >= 36, `expected all API domains, found ${files.length}`);
  for (const file of files) {
    await import(`${pathToFileURL(file).href}?full-migration=${encodeURIComponent(file)}`);
  }
});
