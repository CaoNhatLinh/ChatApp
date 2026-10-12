import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/messenger/model/message.slice.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`, { Date })(exports, name => {
  if (name.endsWith('messengerCopy')) return { MESSENGER_COPY: {} };
  if (name.endsWith('auth.store')) return { useAuthStore: { getState: () => ({ user: { userId: 'actor' } }) } };
  throw new Error(`Unexpected dependency: ${name}`);
});
let state = {};
const slice = exports.createMessageSlice(update => { state = { ...state, ...update(state) }; });
state = { ...slice, conversations: [] };
const pending = id => ({
  messageId: `temp-${id}`, clientMessageId: id, sender: { userId: 'actor' },
  content: 'same intentional text', type: 'TEXT', status: 'sending', createdAt: new Date().toISOString(),
});
slice.addMessage('room', pending('first'));
slice.addMessage('room', pending('second'));
slice.addMessage('room', { ...pending('second'), messageId: 'server-second', messageBucket: '2026-10-03-01:00', status: 'sent' });
assert.deepEqual(Array.from(state.messages.room, message => message.messageId), ['temp-first', 'server-second']);
slice.addMessage('room', { ...pending('first'), messageId: 'server-first', status: 'sent' });
assert.deepEqual(Array.from(state.messages.room, message => message.messageId), ['server-first', 'server-second']);
slice.addMessage('room', { ...pending('second'), messageId: 'server-second', status: 'sent' });
assert.equal(state.messages.room.length, 2);
slice.addMessage('room', { ...pending('first'), messageId: 'server-first', isDeleted: true, content: '' });
slice.addMessage('room', { ...pending('first'), messageId: 'server-first', isDeleted: false, status: 'sent' });
assert.equal(state.messages.room[0].isDeleted, true);
assert.equal(state.messages.room[0].content, '');
slice.updateMessage('room', { ...pending('first'), messageId: 'server-first', isDeleted: false });
assert.equal(state.messages.room[0].isDeleted, true);
assert.equal(state.messages.room[0].content, '');
console.log(JSON.stringify({ passed: 7, boundary: 'Production message slice, identical sends, out-of-order acknowledgements and irreversible tombstones' }));
