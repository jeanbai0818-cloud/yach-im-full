import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { startYachLongConnection } from '../dist/long-connection.js';

// Use a clean process: mocks and accidental globals must not hide vendor errors.
test('bundled SDK loads and constructs a Channel in a clean Node process', () => {
  const result = spawnSync(process.execPath, ['--input-type=commonjs', '-e', `
    const assert = require('node:assert/strict');
    delete globalThis.os;
    assert.equal(globalThis.os, undefined);
    const SDK = require('./dist/vendor/tal-msg-sdk/index.cjs');
    const client = new SDK('yach20001', '1.0.0');
    client.setSdkConfig({extra: {logLevel: 'warn'}});
    const channel = client.getInstance(SDK.CHANNEL);
    for (const method of ['init', 'unInit', 'on', 'off'])
      assert.equal(typeof channel[method], 'function');
    // Construction starts SDK timers; no init/network request is needed here.
    process.exit(0);
  `], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr);
});

const params = {
  account: {accountId: 'default', appKey: 'fixture', appSecret: 'fixture'},
  logger: {info() {}, warn() {}, error() {}},
  onMessage() {},
};
test('SDK load errors propagate to the gateway instead of silently parking the channel', () => {
  assert.throws(() => startYachLongConnection({...params, sdkLoader() {
    throw new ReferenceError('fixture SDK load failure');
  }}), /fixture SDK load failure/);
});
test('SDK construction errors propagate to the gateway', () => {
  assert.throws(() => startYachLongConnection({...params, sdkLoader: () => class {
    constructor() { throw new Error('fixture construction failure'); }
  }}), /fixture construction failure/);
});
