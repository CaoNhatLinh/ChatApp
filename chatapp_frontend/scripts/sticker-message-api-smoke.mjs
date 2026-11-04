import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/messenger/api/messenger.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const requests = [];
const message = {
  conversationId: 'room-a', messageBucket: '2026-10-12-08:00', messageId: 'message-a',
  clientMessageId: 'attempt-a', senderId: 'actor-a', content: '', contentFormat: 'PLAIN',
  revision: 0, messageType: 'STICKER', stickerId: 'sticker-a', isDeleted: false, hasAttachments: false,
  createdAt: '2026-10-12T08:00:00Z',
};
const client = { post: async (...args) => { requests.push(args); return { data: message }; } };
const exports = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`)(exports, name => {
  if (name === '@/shared/api/apiClient') return { __esModule: true, default: client };
  if (name === '@/shared/i18n') return { localizeText: text => text };
  if (name === './poll.api') return { mapCanonicalPollView: value => value };
  throw new Error(`Unexpected dependency: ${name}`);
});

assert.equal(exports.mapToMessage(message).stickerId, 'sticker-a', 'history and realtime mapping retain identity');
const sent = await exports.sendMessageHttp({
  conversationId: 'room-a', clientMessageId: 'attempt-a', type: 'STICKER', content: '', stickerId: 'sticker-a',
});
assert.equal(requests[0][1].stickerId, 'sticker-a', 'HTTP payload carries the selected identity');
assert.equal(requests[0][1].content, '');
assert.equal(requests[0][1].contentFormat, 'PLAIN');
assert.equal(sent.stickerId, 'sticker-a', 'acknowledgement retains identity');
assert.equal(sent.clientMessageId, 'attempt-a', 'acknowledgement keeps retry correlation');
console.log(JSON.stringify({ passed: 3, boundary: 'Production message adapter with controlled HTTP, no live backend' }));
