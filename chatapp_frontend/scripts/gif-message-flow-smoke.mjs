import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import { isAxiosError } from 'axios';

const reference = { provider: 'GIPHY', providerGifId: 'abc123' };
const response = { conversationId: 'room-a', messageBucket: '2026-10-20-08:00', messageId: 'server-a',
  clientMessageId: 'attempt-a', senderId: 'actor-a', content: '', contentFormat: 'PLAIN', revision: 0, messageType: 'GIF',
  gif: reference, isDeleted: false, hasAttachments: false, createdAt: '2026-10-20T08:00:00Z' };
const httpRequests = [];
const source = await readFile(new URL('../src/features/messenger/api/messenger.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const exports = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`)(exports, name => {
  if (name === '@/shared/api/apiClient') return { __esModule: true, default: { post: async (...args) => { httpRequests.push(args); return { data: response }; } } };
  if (name === '@/shared/i18n') return { localizeText: value => value };
  if (name === './poll.api') return { mapCanonicalPollView: value => value };
  throw new Error(`Unexpected dependency: ${name}`);
});
assert.equal(exports.mapToMessage(response).gif, reference, 'HTTP/history/realtime mapping retains typed identity');
assert.equal(exports.mapToMessage({ ...response, forwarded: true }).isForwarded, true, 'public forward marker does not require private source keys');
assert.equal(exports.mapToMessage({ ...response, forwarded: true, isDeleted: true }).isForwarded, false, 'tombstone has no provenance affordance');
assert.equal(exports.mapToMessage({ ...response, forwardedFromConversationId: 'private-room' }).isForwarded, false, 'source-key inference is not the canonical public contract');
const acknowledged = await exports.sendMessageHttp({ conversationId: 'room-a', clientMessageId: 'attempt-a', type: 'GIF', content: '', gif: reference });
assert.equal(httpRequests[0][1].gif, reference);
assert.equal(httpRequests[0][1].content, '');
assert.equal((httpRequests[0][1].attachments ?? []).length, 0);
assert.equal(acknowledged.gif, reference);

const hookSource = await readFile(new URL('../src/features/messenger/model/useMessenger.ts', import.meta.url), 'utf8');
const tree = ts.createSourceFile('useMessenger.ts', hookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(tree) === 'sendMessage'
      && node.initializer && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0];
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(callback);
const hookCode = ts.transpileModule(`const send = ${callback.getText(tree)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const optimistic = [], sent = [], fingerprints = [], cleared = [], statuses = [];
let failure;
const send = vm.runInNewContext(`${hookCode}\nsend`, {
  activeConversationId: 'room-a', user: { userId: 'actor-a' }, getSessionGeneration: () => 1,
  prepareMessageSend: async (actor, payload) => { fingerprints.push(payload); return 'attempt-a'; },
  completeMessageSend: (...args) => cleared.push(args),
  addMessage: (room, message) => optimistic.push(message), upsertConversationFromMessage() {},
  updateMessageStatus: (...args) => statuses.push(args), logger: { error() {} }, SessionChangedError: Error,
  sendMessageHttp: async payload => { sent.push(payload); if (failure) throw failure; return { ...response, gif: payload.gif }; }, isAxiosError, Date,
});
await send('', 'GIF', { gif: reference });
assert.equal(sent.length, 1, 'empty-content GIF reaches canonical send');
assert.equal(JSON.stringify(fingerprints[0].gif), JSON.stringify(reference), 'fingerprint uses a detached copy of the same provider identity');
assert.equal(JSON.stringify(optimistic[0].gif), JSON.stringify(reference));
assert.equal(JSON.stringify(optimistic[1].gif), JSON.stringify(reference));
assert.equal(cleared.length, 1);
await send('', 'TEXT');
await send('', 'GIF');
assert.equal(sent.length, 1, 'empty text and missing GIF identity do not send');
failure = new Error('interrupted');
await assert.rejects(send('', 'GIF', { gif: reference, clientMessageId: 'retry-a' }), error => error === failure);
assert.equal(sent.at(-1).clientMessageId, 'retry-a');
assert.equal(JSON.stringify(sent.at(-1).gif), JSON.stringify(reference), 'retry retains provider identity values, not caller object identity');
assert.equal(statuses.at(-1)[2], 'failed');
assert.equal(cleared.length, 1);
failure = undefined;
await send('', 'GIF', { gif: reference, clientMessageId: 'retry-a' });
assert.equal(cleared.at(-1)[2], 'retry-a');
assert.ok(!JSON.stringify(sent).includes('http'), 'canonical send does not include provider media URLs');
const parent = { messageId: 'parent-a', messageBucket: '2026-10-20-08:03', senderId: 'parent-sender' };
const mappedReply = exports.mapToMessage({ ...response, replyToMessageId: parent.messageId,
  replyToMessageBucket: parent.messageBucket, replyToSenderId: parent.senderId });
assert.equal(mappedReply.replyTo.messageBucket, parent.messageBucket);
assert.equal(mappedReply.replyTo.senderId, parent.senderId);
await exports.sendMessageHttp({ conversationId: 'room-a', clientMessageId: 'reply-attempt', type: 'TEXT', content: 'reply',
  replyToId: parent.messageId, replyToMessageBucket: parent.messageBucket });
assert.equal(httpRequests.at(-1)[1].replyToMessageBucket, parent.messageBucket);
assert.equal(httpRequests.at(-1)[1].replyToSenderId, undefined, 'sender is server-derived');
failure = new Error('reply interrupted');
await assert.rejects(send('reply', 'TEXT', { replyToId: parent.messageId, replyToMessageBucket: parent.messageBucket }), error => error === failure);
assert.equal(optimistic.at(-1).replyTo.messageBucket, parent.messageBucket, 'failed optimistic message retains exact parent for retry');
assert.equal(fingerprints.at(-1).replyToMessageBucket, parent.messageBucket);
console.log(JSON.stringify({ passed: 15, boundary: 'Production adapters and AST-extracted send callback, controlled HTTP/store; includes full reply-key mapping/send/retry; no live browser/backend/provider' }));
