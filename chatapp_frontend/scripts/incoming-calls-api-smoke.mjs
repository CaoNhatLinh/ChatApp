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
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  });
  return exports;
};

const channel = await load('../src/features/calls/model/call-command-channel.ts');
let response, failure, received;
const client = { get: async (...args) => { received = args; if (failure) throw failure; return response; } };
const api = await load('../src/features/calls/api/incoming-calls.api.ts', {
  '@/shared/api/apiClient': { default: client }, '../model/call-command-channel': channel,
});
const actorId = randomUUID();
const query = { actorId };
const signal = new AbortController().signal;
const now = new Date().toISOString();
const state = { conversationId: randomUUID(), callId: randomUUID(), callerId: randomUUID(), calleeId: actorId,
  callType: 'VOICE', status: 'RINGING', version: 1, revision: randomUUID(), createdAt: now,
  deadline: now, acceptedAt: null, endedAt: null };
const page = (content = [state], nextCursor = null, hasNext = false) => ({ content, nextCursor, hasNext });
const json = value => JSON.parse(JSON.stringify(value));
let passed = 0;

response = { status: 200, data: page() };
assert.deepEqual(json(await api.getIncomingCalls(query, signal)), page());
assert.equal(received[0], '/calls/incoming');
assert.deepEqual(json(received[1].params), { limit: 50 });
assert.equal(received[1].signal, signal);
assert.equal(received[1].headers['Cache-Control'], 'no-store');
assert.equal('actorId' in received[1].params, false);
assert.deepEqual(query, { actorId });
passed++;

response = { status: 200, data: page([]) };
assert.deepEqual(json(await api.getIncomingCalls(query, signal)), page([]));
passed++;

const opaqueCursor = 'opaque_cursor-characters.A+B/=?%';
response = { status: 200, data: page([], opaqueCursor, true) };
assert.deepEqual(json(await api.getIncomingCalls(query, signal)), page([], opaqueCursor, true));
response = { status: 200, data: page() };
await api.getIncomingCalls({ actorId, cursor: opaqueCursor }, signal);
assert.deepEqual(json(received[1].params), { limit: 50, cursor: opaqueCursor });
assert.equal(received[1].signal, signal);
passed++;

response = { status: 200, data: page([state], 'x'.repeat(1024), true) };
assert.equal((await api.getIncomingCalls(query, signal)).nextCursor.length, 1024);
passed++;

response = { status: 200, data: page(Array.from({ length: 50 }, () => ({ ...state, callId: randomUUID() }))) };
assert.equal((await api.getIncomingCalls(query, signal)).content.length, 50);
passed++;

response = { status: 200, data: { ...page([{ ...state, signal: { sdp: 'private' }, unexpected: true }]), debug: 'internal' } };
const clean = await api.getIncomingCalls(query, signal);
assert.deepEqual(json(clean), page());
assert.notEqual(clean.content[0], response.data.content[0]);
passed++;

response = { status: 200, data: page([{ ...state, deadline: '2000-01-01T00:00:00.000Z' }]) };
assert.equal((await api.getIncomingCalls(query, signal)).content[0].deadline, '2000-01-01T00:00:00.000Z');
passed++;

const invalidPage = async (data, status = 200) => {
  response = { status, data };
  await assert.rejects(api.getIncomingCalls(query, signal), error => error instanceof channel.CallCommandError && error.code === 'INVALID_RESPONSE');
  passed++;
};

for (const data of [null, [], {}, '', { content: [] }, { nextCursor: null, hasNext: false },
  page(null), page({}), page('bad'), page(Array(51).fill(state)), { content: [], nextCursor: undefined, hasNext: false },
  { content: [], hasNext: false }, { content: [], nextCursor: null }, { content: [], nextCursor: null, hasNext: undefined },
  page([], null, 'false'), page([], null, 0), page([], null, true), page([], '', true),
  page([], '   ', true), page([], 4, true), page([], 'x'.repeat(1025), true),
  page([], 'unexpected', false), page([], '', false)]) {
  await invalidPage(data);
}

const zeroId = '00000000-0000-0000-0000-000000000000';
for (const field of ['conversationId', 'callId', 'callerId', 'calleeId', 'revision']) {
  for (const value of ['invalid', zeroId, null, 42]) await invalidPage(page([{ ...state, [field]: value }]));
}

for (const content of [
  [null], [[]], [Object.assign([], state)], [{}], Array(1), [state, { ...state, callerId: actorId }],
  [{ ...state, callerId: actorId }], [{ ...state, calleeId: randomUUID() }],
  [{ ...state, callerId: actorId, calleeId: state.callerId }],
  [{ ...state, status: 'ACCEPTED', acceptedAt: now }], [{ ...state, status: 'ENDED', endedAt: now }],
  [{ ...state, status: 'unknown' }], [{ ...state, callType: 'TEXT' }],
  [{ ...state, version: 0 }], [{ ...state, version: 1.5 }], [{ ...state, version: Number.MAX_SAFE_INTEGER + 1 }],
  [{ ...state, createdAt: 'invalid' }], [{ ...state, deadline: 'invalid' }],
  [{ ...state, acceptedAt: now }], [{ ...state, endedAt: now }],
  [{ ...state, acceptedAt: undefined }], [{ ...state, endedAt: undefined }],
]) await invalidPage(page(content));

for (const status of [201, 202, 204, 304, 400, 401, 403, 404, 500]) await invalidPage(page(), status);

for (const error of [new Error('transport unavailable'), Object.assign(new Error('unauthorized'), { response: { status: 401 } }),
  Object.assign(new Error('forbidden'), { response: { status: 403 } })]) {
  failure = error;
  await assert.rejects(api.getIncomingCalls(query, signal), actual => actual === error);
  passed++;
}

const aborted = new AbortController();
aborted.abort();
failure = Object.assign(new Error('request canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' });
await assert.rejects(api.getIncomingCalls(query, aborted.signal), error => error === failure);
assert.equal(received[1].signal, aborted.signal);
assert.equal(received[1].signal.aborted, true);
passed++;

console.log(JSON.stringify({ passed, boundary: 'Actual incoming adapter/canonical parser with controlled HTTP port; no browser or live backend' }));
