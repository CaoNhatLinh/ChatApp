import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

const load = async (path, dependencies = {}) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(exports,require){${code}})`, {})(exports, name => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`); return dependencies[name];
  });
  return exports;
};
const channel = await load('../src/features/calls/model/call-command-channel.ts');
let response, failure, received;
const client = { get: async (...args) => { received = args; if (failure) throw failure; return response; } };
const api = await load('../src/features/calls/api/active-call.api.ts', { '@/shared/api/apiClient': { default: client }, '../model/call-command-channel': channel });
const scope = { conversationId: randomUUID(), actorId: randomUUID(), peerUserId: randomUUID() };
const now = new Date().toISOString();
const state = { conversationId: scope.conversationId, callId: randomUUID(), callerId: scope.peerUserId, calleeId: scope.actorId,
  callType: 'VOICE', status: 'RINGING', version: 1, revision: randomUUID(), createdAt: now, deadline: now, acceptedAt: null, endedAt: null };
const signal = new AbortController().signal;
response = { status: 200, data: state };
assert.equal((await api.getActiveCall(scope, signal)).callId, state.callId);
assert.equal(received[0], `/conversations/${scope.conversationId}/calls/active`); assert.equal(received[1].signal, signal);
response = { status: 204, data: '' }; assert.equal(await api.getActiveCall(scope, signal), null);
let passed = 2;
for (const data of [null, {}, { ...state, callId: 'bad' }, { ...state, callId: '00000000-0000-0000-0000-000000000000' },
  { ...state, conversationId: randomUUID() }, { ...state, callerId: randomUUID() }, { ...state, version: 0 },
  { ...state, status: 'ENDED', endedAt: now }, { ...state, status: 'ACCEPTED', acceptedAt: null }]) {
  response = { status: 200, data }; await assert.rejects(api.getActiveCall(scope, signal), error => error.code === 'INVALID_RESPONSE'); passed++;
}
for (const status of [202, 404, 500]) {
  response = { status, data: state }; await assert.rejects(api.getActiveCall(scope, signal)); passed++;
}
failure = new Error('denied'); await assert.rejects(api.getActiveCall(scope, signal), error => error === failure); passed++;
console.log(JSON.stringify({ passed, boundary: 'Actual adapter/parser with controlled HTTP port, not browser or live backend' }));
