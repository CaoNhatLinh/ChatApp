import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/messenger/model/messageSendAttempt.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const records = new Map();
const storage = {
  getItem: key => records.get(key) ?? null,
  setItem: (key, value) => records.set(key, value),
  removeItem: key => records.delete(key),
};
function load(sessionStorage = storage) {
  const exports = {};
  vm.runInNewContext(`(function(exports, require) { ${code} })`, {
    window: { sessionStorage }, crypto: webcrypto, TextEncoder, Uint8Array,
  })(exports, name => {
    assert.equal(name, '@/shared/lib/logger');
    return { logger: { warn() {} } };
  });
  return exports;
}
const payload = { conversationId: 'room-a', content: 'hello', type: 'TEXT', mentions: [], attachments: [] };
const firstRuntime = load();
const first = await firstRuntime.prepareMessageSend('user-a', payload);
assert.equal(await firstRuntime.prepareMessageSend('user-a', payload), first);
const reloaded = load();
assert.equal(await reloaded.prepareMessageSend('user-a', payload), first);
assert.ok(![...records.values()].some(value => value.includes('hello')));
assert.notEqual(await reloaded.prepareMessageSend('user-b', payload), first);
assert.notEqual(await reloaded.prepareMessageSend('user-a', { ...payload, conversationId: 'room-b' }), first);
const changed = await reloaded.prepareMessageSend('user-a', { ...payload, content: 'edited' });
assert.notEqual(changed, first);
reloaded.completeMessageSend('user-a', 'room-a', first);
assert.equal(await reloaded.prepareMessageSend('user-a', { ...payload, content: 'edited' }), changed);
reloaded.completeMessageSend('user-a', 'room-a', changed);
assert.notEqual(await reloaded.prepareMessageSend('user-a', { ...payload, content: 'edited' }), changed);
const replies = await reloaded.prepareMessageSend('user-a', { ...payload, replyToId: 'message-a' });
assert.notEqual(await reloaded.prepareMessageSend('user-a', { ...payload, replyToId: 'message-b' }), replies);
await assert.rejects(load({ ...storage, setItem() { throw new Error('quota'); } })
  .prepareMessageSend('new-user', payload), /quota/);
await assert.rejects(load({ ...storage, getItem: () => '{invalid' })
  .prepareMessageSend('user-a', payload));
const concurrent = await Promise.all(Array.from({ length: 3 }, () => reloaded.prepareMessageSend('user-c', payload)));
assert.equal(new Set(concurrent).size, 1);
console.log(JSON.stringify({ passed: 12, boundary: 'Production send-attempt storage with WebCrypto and controlled per-tab storage' }, null, 2));
