import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/messenger/model/conversation-entry.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
let generation = 1, request;
const state = { activeConversationId: 'a', conversations: [], conversationEntry: null,
  setConversationEntry: value => { state.conversationEntry = value; },
  hoistConversation: value => { state.conversations.push(value); } };
const module = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`, { crypto })(module, name => {
  if (name === 'axios') return { __esModule: true, default: { isAxiosError: error => Boolean(error?.isAxiosError) } };
  if (name === './messenger.store') return { useMessengerStore: { getState: () => state } };
  if (name === '../api/messenger.api') return { getConversationById: async () => request() };
  if (name === '@/shared/auth/access-token') return { getSessionGeneration: () => generation };
  throw new Error(`Unexpected dependency ${name}`);
});
const open = module.loadConversationEntry;
request = async () => { throw { isAxiosError: true, response: { status: 503, data: { message: 'private diagnostic' } } }; };
assert.equal(await open('a'), false);
assert.equal(state.conversationEntry.status, 'error');
assert.equal(state.conversationEntry.reason, 'unavailable');
assert.equal(JSON.stringify(state).includes('private diagnostic'), false);
request = async () => ({ conversationId: 'a', name: 'Public peer' });
assert.equal(await open('a'), true);
assert.equal(state.conversationEntry, null);
assert.equal(state.conversations[0].name, 'Public peer');
for (const [status, reason] of [[403, 'forbidden'], [404, 'missing'], [400, 'invalid'], [409, 'unavailable']]) {
  state.conversations = [];
  request = async () => { throw { isAxiosError: true, response: { status } }; };
  assert.equal(await open('a'), false);
  assert.equal(state.conversationEntry.reason, reason);
}
let release;
request = () => new Promise(resolve => { release = resolve; });
const old = open('a');
assert.equal(state.conversationEntry.status, 'loading');
state.activeConversationId = 'b'; state.conversationEntry = null;
release({ conversationId: 'a' });
assert.equal(await old, false);
assert.equal(state.conversations.length, 0, 'navigation ignores a late success');
state.activeConversationId = 'a';
const oldSession = open('a');
const pendingSession = state.conversationEntry;
generation++;
release({ conversationId: 'a' });
assert.equal(await oldSession, false);
assert.equal(state.conversations.length, 0, 'session replacement ignores a late success');
assert.equal(state.conversationEntry, pendingSession, 'old session cannot mutate the new session state');
request = () => new Promise(resolve => { release = resolve; });
const firstAttempt = open('a'), firstRelease = release;
const secondAttempt = open('a');
release({ conversationId: 'a', name: 'Current request' });
assert.equal(await secondAttempt, true);
firstRelease({ conversationId: 'a', name: 'Old request' });
assert.equal(await firstAttempt, false);
assert.equal(state.conversations.length, 1, 'older attempts cannot replace the latest summary');
console.log(JSON.stringify({ passed: 24, boundary: 'Actual conversation-entry state model; controlled HTTP/store/session' }));
