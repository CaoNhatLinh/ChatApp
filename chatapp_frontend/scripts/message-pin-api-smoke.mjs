import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const requests = [];
const ref = { messageId: 'message', messageBucket: '2026-10-23-08:00' };
const message = { ...ref, conversationId: 'room', revision: 0, senderId: 'actor', content: 'message',
  messageType: 'TEXT', createdAt: '2026-10-23T08:00:00Z', isDeleted: false };
let state = { conversationId: 'room', revision: '9', pins: [] };
let conflict = false;
const client = {
  get: async (...args) => { requests.push(['GET', ...args]); return { data: state }; },
  post: async (...args) => {
    requests.push(['POST', ...args]); if (conflict) throw new Error('Controlled 409');
    state = { ...state, revision: '10', pins: [ref] };
    return { data: { message: { ...message, isPinned: true }, pinState: state } };
  },
  delete: async (...args) => {
    requests.push(['DELETE', ...args]); state = { ...state, revision: '11', pins: [] };
    return { data: { message: { ...message, isPinned: false }, pinState: state } };
  },
};
const code = ts.transpileModule(readFileSync(new URL('../src/features/messenger/api/messenger.api.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const api = {};
vm.runInNewContext(`(function(exports,require){${code}})`, { BigInt })(api, name => {
  if (name === '@/shared/api/apiClient') return { __esModule: true, default: client };
  if (name === '@/shared/i18n') return { localizeText: value => value };
  if (name === './poll.api') return { mapCanonicalPollView: value => value };
  throw new Error(name);
});
await api.getMessagePinState('room');
await api.togglePinMessage('room', ref.messageBucket, ref.messageId, true, '9');
assert.equal(requests[1][2].expectedRevision, '9');
await api.togglePinMessage('room', ref.messageBucket, ref.messageId, false, '10');
assert.equal(requests[2][2].data.expectedRevision, '10');
assert.equal(state.revision, '11');
for (const invalid of [null, { ...state, revision: 1 }, { ...state, revision: '01' },
  { ...state, revision: '9223372036854775808' }, { ...state, conversationId: 'other' },
  { ...state, pins: [ref, ref] }, { ...state, pins: [{ messageId: 'message' }] }]) {
  assert.throws(() => api.mapMessagePinState(invalid, 'room'), /pin state/i);
}
assert.equal(api.mapMessagePinState({ ...state, revision: '9223372036854775807' }, 'room').revision, '9223372036854775807');
conflict = true;
const before = requests.length;
await assert.rejects(api.togglePinMessage('room', ref.messageBucket, ref.messageId, true, '11'), /409/);
assert.equal(requests.length - before, 1, 'conflicts do not silently refetch/replay the old intent');
console.log(JSON.stringify({ passed: 6, boundary: 'Actual pin API adapter and strict snapshot parser; controlled transport, not live backend' }));
