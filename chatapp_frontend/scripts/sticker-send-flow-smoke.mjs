import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { isAxiosError } from 'axios';

const source = await readFile(new URL('../src/features/messenger/model/useMessenger.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('useMessenger.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'sendMessage'
    && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(callback, 'production send callback exists');
const code = ts.transpileModule(`const send = ${callback.getText(tree)};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const messages = [];
const requests = [];
const prepared = [];
const cleared = [];
const statuses = [];
let transportFailure;
const context = {
  activeConversationId: 'room-a', user: { userId: 'actor-a' },
  getSessionGeneration: () => 1,
  prepareMessageSend: async (actor, payload) => { prepared.push(payload); return 'attempt-a'; },
  completeMessageSend: (...args) => cleared.push(args),
  addMessage: (room, message) => messages.push(message), upsertConversationFromMessage() {},
  updateMessageStatus: (...args) => statuses.push(args), logger: { error() {} }, SessionChangedError: Error,
  sendMessageHttp: async request => {
    requests.push(request);
    if (transportFailure) throw transportFailure;
    return { ...request, messageId: 'server-a', sender: { userId: 'actor-a' } };
  }, isAxiosError, Date,
};
const send = vm.runInNewContext(`${code}\nsend`, context);
await send('', 'STICKER', { stickerId: 'sticker-a' });
assert.equal(requests.length, 1, 'empty-content sticker reaches HTTP');
assert.equal(prepared[0].stickerId, 'sticker-a', 'retry fingerprint includes selected sticker');
assert.equal(messages[0].stickerId, 'sticker-a', 'optimistic message retains selected sticker');
assert.equal(messages[1].status, 'sent');
assert.equal(cleared.length, 1, 'confirmed send clears its attempt');
await send('', 'TEXT');
assert.equal(requests.length, 1, 'empty text is still ignored');
transportFailure = new Error('connection interrupted');
await assert.rejects(send('', 'STICKER', { stickerId: 'sticker-a', clientMessageId: 'retry-a' }), error => error === transportFailure);
assert.equal(requests.at(-1).clientMessageId, 'retry-a', 'retry keeps the original attempt identity');
assert.equal(requests.at(-1).stickerId, 'sticker-a');
assert.equal(statuses.at(-1)[2], 'failed', 'failed sticker is visibly retryable');
assert.equal(cleared.length, 1, 'failure does not clear the pending attempt');
transportFailure = undefined;
await send('', 'STICKER', { stickerId: 'sticker-a', clientMessageId: 'retry-a' });
assert.equal(cleared.length, 2, 'confirmed explicit retry also clears its matching stored attempt');
assert.equal(cleared.at(-1)[2], 'retry-a');
console.log(JSON.stringify({ passed: 4, boundary: 'Production hook callback extracted by TypeScript AST with controlled dependencies, not browser rendering' }));
