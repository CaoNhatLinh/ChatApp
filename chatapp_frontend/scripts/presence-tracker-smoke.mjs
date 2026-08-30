import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const sourcePath = path.resolve('src/features/presence/services/presenceTrackingState.ts');
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
const { createPresenceTrackingController } = moduleRecord.exports;

const events = [];
const tracker = createPresenceTrackingController({
  subscribe: (userIds, conversationId) => events.push(['subscribe', conversationId, userIds]),
  unsubscribe: (userIds, conversationId) => events.push(['unsubscribe', conversationId, userIds]),
  sendBatch: (userIds, conversationId) => events.push(['batch', conversationId, userIds]),
  clearPresence: (userId) => events.push(['clear', userId]),
});

const target = '00000000-0000-0000-0000-000000000001';
const room = '00000000-0000-0000-0000-000000000042';

tracker.watch([target, target], room);
tracker.watch([target], null);
tracker.resync();
assert.deepEqual(events, [
  ['subscribe', room, [target]],
  ['subscribe', room, [target]],
  ['batch', room, [target]],
]);

events.length = 0;
tracker.unwatch([target], room);
assert.deepEqual(events, [
  ['unsubscribe', room, [target]],
  ['clear', target],
  ['subscribe', null, [target]],
]);

events.length = 0;
tracker.unwatch([target], null);
assert.deepEqual(events, [
  ['unsubscribe', null, [target]],
  ['clear', target],
]);

events.length = 0;
tracker.watch([target], room);
tracker.clear();
assert.deepEqual(events, [
  ['subscribe', room, [target]],
  ['unsubscribe', room, [target]],
]);

console.log(JSON.stringify({ sourcePath, transitionsVerified: 4 }, null, 2));
