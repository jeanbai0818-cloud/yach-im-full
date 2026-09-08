import test from 'node:test';
import assert from 'node:assert/strict';
import { queryHistory, classifySender } from '../dist/full/history-query.js';
const { yachGetHistory } = await import('../dist/full/yach-im-full/plugin/tools/ch1-messaging.js');

test('cloud pagination preserves timestamp ties through server IDs', async () => {
  const source = Array.from({length: 205}, (_, i) => ({ idServer: String(i+1), time: 5000 - Math.floor(i / 50), isBot: i % 2 === 0 }));
  const calls = [];
  const result = await queryHistory(async options => {
    calls.push(options);
    const offset = options.lastMsgId ? source.findIndex(m => m.idServer === options.lastMsgId)+1 : 0;
    return source.slice(offset, offset+options.limit);
  }, {limit: 150, startTime: 1000, endTime: 6000});
  assert.equal(result.messages.length, 150);
  assert.equal(new Set(result.messages.map(m => m.idServer)).size, 150);
  assert.equal(calls[1].lastMsgId, '100');
  assert.equal(result.nextCursor.endTime, 4997);
  assert.equal(calls[1].endTime, 4998);
});

test('sender filtering scans past excluded messages and preserves unknown', async () => {
  assert.equal(classifySender({fromClientType: 'Server', type: 'custom'}).senderKind, 'unknown');
  assert.equal(classifySender({fromClientType: 'Web'}).senderKind, 'unknown');
  const pages = [[{idServer:'3',time:3,isBot:true}], [{idServer:'2',time:2,isBot:false}]];
  const result = await queryHistory(async () => pages.shift() || [], {limit:1,startTime:0,endTime:4,senderKind:'human'});
  assert.equal(result.messages[0].idServer, '2');
  assert.equal(result.pages, 2);
});

test('invalid ranges fail before requesting cloud data and scan bounds are explicit', async () => {
  await assert.rejects(queryHistory(() => { throw Error('must not call'); }, {startTime:10,endTime:5}), /startTime/);
  const result = await queryHistory(async () => [{idServer:'1',time:1}], {limit:1,endTime:2,senderKind:'bot',maxPages:1});
  assert.equal(result.exhausted,false);
  assert.ok(result.warnings.length);
  assert.ok(result.nextCursor);
});

test('history tool reports missing NIM authentication separately from an empty result', async () => {
  await assert.rejects(
    yachGetHistory.execute('no-auth', { userId: '438470', limit: 1 }),
    error => error?.code === 'YACH_HISTORY_NOT_AUTHENTICATED'
      && /NIM 尚未登录/u.test(error.message)
      && !/没有查到/u.test(error.message),
  );
});
