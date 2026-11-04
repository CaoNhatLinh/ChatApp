import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const source = await readFile(new URL('../src/features/messenger/api/messenger.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const requests = [];
let data = { content: [], hasNext: true, nextCursor: 'opaque-scan-cursor' };
const client = { get: async (...args) => { requests.push(args); return { data }; } };
const api = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`)(api, name => {
  if (name === '@/shared/api/apiClient') return { __esModule: true, default: client };
  if (name === '@/shared/i18n') return { localizeText: text => text };
  if (name === './poll.api') return { mapCanonicalPollView: value => value };
  throw new Error(`Unexpected dependency ${name}`);
});
const signal = new AbortController().signal;
const result = await api.getConversations(30, 'previous', { query: 'Linh', filter: 'UNREAD', signal });
assert.equal(requests[0][1].params.q, 'Linh');
assert.equal(requests[0][1].params.filter, 'UNREAD');
assert.equal(requests[0][1].signal, signal);
assert.equal(result.hasNext, true);
assert.equal(result.nextCursor, 'opaque-scan-cursor');
data = { content: [{ conversation: { conversationId: 'room', conversationType: 'DM', name: 'DM', defaultNotificationLevel: 'ALL', chatMode: 'OPEN', slowModeSeconds: 0 },
  peer: { userId: 'peer', username: 'linh', displayName: 'Linh', avatarUrl: null }, pinned: true, unreadCount: 2, notificationOverride: 'INHERIT' }], hasNext: false, nextCursor: null };
const dm = (await api.getConversations()).content[0];
assert.equal(dm.name, 'Linh');
assert.equal(dm.otherParticipant.userName, 'linh');
assert.equal(dm.otherParticipant.userId, 'peer');
const summary = data.content[0];
data = summary;
const opened = await api.getConversationById('room');
assert.equal(requests.at(-1)[0], '/conversations/room/summary');
assert.equal(opened.name, 'Linh');
assert.equal(opened.otherParticipant.userId, 'peer');
assert.equal(opened.isPinned, true);
assert.equal(opened.unreadCount, 2);
assert.equal(opened.notificationOverride, 'INHERIT');
data = { ...summary, conversation: { ...summary.conversation, conversationId: 'other-room' } };
await assert.rejects(api.getConversationById('room'), /summary/i);
data = { ...summary, unreadCount: -1 };
await assert.rejects(api.getConversationById('room'), /summary/i);
data = summary.conversation;
await assert.rejects(api.getConversationById('room'), /summary/i);
const lastMessage = { messageId: 'message', messageBucket: '2026-10-23-08:00', revision: 7,
  senderId: 'peer', senderDisplayName: 'Linh', contentPreview: 'Current edit', messageType: 'TEXT',
  createdAt: '2026-10-23T08:00:00Z', deleted: false, hasAttachments: false };
data = { ...summary, lastMessage };
assert.equal((await api.getConversationById('room')).lastMessage.revision, 7);
data = { content: [{ ...summary, lastMessage }], hasNext: false, nextCursor: null };
assert.equal((await api.getConversations()).content[0].lastMessage.revision, 7);
for (const revision of [undefined, null, -1, 0.5, 2147483648, '7']) {
  data = { ...summary, lastMessage: { ...lastMessage, revision } };
  await assert.rejects(api.getConversationById('room'), /revision/i);
}

const hookSource = await readFile(new URL('../src/features/messenger/model/useMessenger.ts', import.meta.url), 'utf8');
const hook = ts.createSourceFile('useMessenger.ts', hookSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const pinCallbacks = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
    const name = node.name.getText(hook);
    if (name === 'pinConversation' || name === 'unpinConversation') {
      pinCallbacks.set(name, node.initializer.arguments[0].getText(hook));
    }
  }
  ts.forEachChild(node, visit);
}
visit(hook);
assert.equal(pinCallbacks.size, 2);

for (const [name, callback] of pinCallbacks) {
  let generation = 1;
  let finishRequest;
  const changes = [];
  class SessionChangedError extends Error {}
  const callbackCode = ts.transpileModule(`const mutate = ${callback};`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mutate = vm.runInNewContext(`${callbackCode}\nmutate`, {
    getSessionGeneration: () => generation,
    SessionChangedError,
    [`${name}Api`]: () => new Promise(resolve => { finishRequest = resolve; }),
    [`${name}Store`]: room => changes.push(room),
  });

  const stale = mutate('room');
  generation++;
  finishRequest();
  await assert.rejects(stale, SessionChangedError);
  assert.deepEqual(changes, [], `${name} completion from the previous session leaves the store untouched`);

  const current = mutate('room');
  finishRequest();
  await current;
  assert.deepEqual(changes, ['room'], `${name} completion in the current session still updates the store`);
}
console.log(JSON.stringify({ passed: 24, boundary: 'Production directory/summary adapters and pin/unpin hook callbacks; transport controlled' }));
