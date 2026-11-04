import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/messenger/api/thread.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const scope = { conversationId: 'room-a', messageId: 'parent-a', messageBucket: '2026-10-20-08:03' };
const message = { ...scope, senderId: 'peer-a', content: 'source', contentFormat: 'PLAIN', revision: 0, messageType: 'TEXT',
  isDeleted: false, hasAttachments: false, hasMentions: false, isPinned: false, createdAt: '2026-10-20T08:00:00Z' };
const reply = { ...message, messageId: 'reply-a', replyToMessageId: scope.messageId, replyToMessageBucket: scope.messageBucket };
let response = { parent: message, content: [reply], hasNext: true, nextCursor: 'opaque-a' };
const calls = [], exports = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`)(exports, name => {
  assert.equal(name, '@/shared/api/apiClient');
  return { __esModule: true, default: { get: async (...args) => { calls.push(args); return { data: response }; } } };
});
const signal = new AbortController().signal;
const page = await exports.getMessageThread(scope, { cursor: null, signal });
assert.equal(page.parent, message); assert.equal(page.content[0], reply);
assert.equal(calls[0][0], '/conversations/room-a/messages/parent-a/replies');
assert.equal(calls[0][1].params.bucket, scope.messageBucket); assert.equal(calls[0][1].params.limit, 25);
assert.equal(calls[0][1].signal, signal);
response = { ...response, content: [] };
assert.equal((await exports.getMessageThread(scope, { cursor: null, signal })).hasNext, true, 'empty page can continue');
const valid = response;
for (const invalid of [
  { ...valid, nextCursor: null }, { ...valid, nextCursor: 'same' },
  { ...valid, parent: { ...message, conversationId: 'other-room' } },
  { ...valid, parent: { ...message, messageBucket: 'other-bucket' } },
  { ...valid, content: [{ ...reply, replyToMessageId: 'other-parent' }] },
  { ...valid, content: [{ ...reply, content: 42 }] },
  { ...valid, content: [reply, reply] }, { ...valid, hasNext: 'yes' },
]) {
  response = invalid;
  await assert.rejects(exports.getMessageThread(scope, { cursor: 'same', signal }));
}
response = { parent: { ...message, content: '', isDeleted: true }, content: [{ ...reply, content: '', isDeleted: true,
  replyToMessageId: null, replyToMessageBucket: null }], hasNext: false, nextCursor: null };
assert.equal((await exports.getMessageThread(scope, { signal })).parent.isDeleted, true);
console.log(JSON.stringify({ passed: 13, boundary: 'Production thread adapter with controlled HTTP; not live server' }));
