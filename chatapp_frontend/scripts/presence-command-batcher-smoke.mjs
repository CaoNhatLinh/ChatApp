import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve('src/features/presence/services/presenceCommandBatcher.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    strict: true,
  },
  fileName: sourcePath,
}).outputText;
const moduleRecord = { exports: {} };
new Function('module', 'exports', compiled)(moduleRecord, moduleRecord.exports);
const { createPresenceCommandBatcher } = moduleRecord.exports;

function createFixture() {
  const events = [];
  const scheduled = [];
  const batcher = createPresenceCommandBatcher({
    transport: {
      subscribe: (userIds, conversationId) => events.push(['subscribe', conversationId, userIds]),
      unsubscribe: (userIds, conversationId) => events.push(['unsubscribe', conversationId, userIds]),
      sendBatch: (userIds, conversationId) => events.push(['batch', conversationId, userIds]),
      clearPresence: (userId) => events.push(['clear', userId]),
    },
    scheduleFlush: (callback) => {
      scheduled.push(callback);
      return callback;
    },
    cancelScheduledFlush: () => {},
  });
  return { batcher, events, flushScheduled: () => scheduled.shift()?.() };
}

const room = '00000000-0000-0000-0000-000000000042';
const first = '00000000-0000-0000-0000-000000000001';
const second = '00000000-0000-0000-0000-000000000002';

{
  const { batcher, events, flushScheduled } = createFixture();
  batcher.subscribe([first], room);
  batcher.subscribe([second, first], room);
  assert.deepEqual(events, []);
  flushScheduled();
  assert.deepEqual(events, [['subscribe', room, [first, second]]]);
}

{
  const { batcher, events, flushScheduled } = createFixture();
  batcher.subscribe([first], room);
  batcher.unsubscribe([first], room);
  flushScheduled();
  assert.deepEqual(events, []);
}

{
  const { batcher, events, flushScheduled } = createFixture();
  batcher.subscribe([first, second], room);
  flushScheduled();
  events.length = 0;
  batcher.unsubscribe([first], room);
  batcher.subscribe([first], room);
  flushScheduled();
  assert.deepEqual(events, []);
}

{
  const { batcher, events } = createFixture();
  batcher.subscribe([first, second], room);
  batcher.sendBatch([first, second], room);
  assert.deepEqual(events, [
    ['subscribe', room, [first, second]],
    ['batch', room, [first, second]],
  ]);
}

console.log(JSON.stringify({ sourcePath, behaviorsVerified: 4 }, null, 2));
