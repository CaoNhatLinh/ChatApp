import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';

async function load(path, dependencies = {}) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(exports,require){${code}})`, {})(exports, name => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`);
    return dependencies[name];
  });
  return exports;
}

const channel = await load('../src/features/calls/model/call-command-channel.ts');
let response, received, failure, requests = 0;
const client = { get: async (...args) => { requests++; received = args; if (failure) throw failure; return response; } };
const api = await load('../src/features/calls/api/call-history.api.ts', {
  '@/shared/api/apiClient': { default: client }, '../model/call-command-channel': channel,
});
const actorId = randomUUID();
const query = { actorId, month: '2026-10' };
const signal = new AbortController().signal;
const createdAt = '2026-10-01T10:00:00Z';
const entry = {
  conversationId: randomUUID(), callId: randomUUID(), callerId: randomUUID(), calleeId: actorId,
  callType: 'VOICE', direction: 'INCOMING', outcome: 'RINGING', createdAt,
  acceptedAt: null, endedAt: null, version: 1,
};
entry.participants = [
  { userId: entry.callerId, role: 'CALLER', initiatedAt: createdAt, acceptedAt: null },
  { userId: actorId, role: 'CALLEE', initiatedAt: null, acceptedAt: null },
];
const page = (content = [entry], nextCursor = null, hasNext = false) => ({ content, nextCursor, hasNext });
const json = value => JSON.parse(JSON.stringify(value));

response = { status: 200, data: page() };
assert.deepEqual(json(await api.getCallHistory(query, signal)), page());
assert.equal(received[0], '/calls/history');
assert.deepEqual(json(received[1].params), { month: query.month, limit: 50 });
assert.equal(received[1].signal, signal);
assert.equal(received[1].headers['Cache-Control'], 'no-store');
let passed = 1;
const invalidResponse = async (data, scope = query, status = 200) => {
  response = { status, data };
  await assert.rejects(api.getCallHistory(scope, signal), error => error instanceof channel.CallCommandError && error.code === 'INVALID_RESPONSE');
  passed++;
};

for (const data of [null, [], {}, page(null), page(Array(51).fill(entry)),
  page([], null, true), page([], '', true), page([], ' ', true), page([], 42, true), page([], 'x'.repeat(1025), true),
  page([], 'unexpected', false), page([], undefined, 'false'), { content: [], hasNext: false }]) await invalidResponse(data);
for (const status of [201, 204]) await invalidResponse(page(), query, status);

const zeroId = '00000000-0000-0000-0000-000000000000';
for (const field of ['conversationId', 'callId', 'callerId', 'calleeId']) {
  for (const value of ['bad', zeroId, null, 4]) await invalidResponse(page([{ ...entry, [field]: value }]));
}
for (const change of [
  { callerId: actorId }, { calleeId: randomUUID() }, { direction: 'OUTGOING' }, { direction: null },
  { callType: 'AUDIO' }, { outcome: 'UNKNOWN' }, { version: 0 }, { version: 1.5 }, { version: Number.MAX_SAFE_INTEGER + 1 },
  { createdAt: '2026-09-30T23:59:59Z' }, { createdAt: '2026-10-33T10:00:00Z' }, { createdAt: 'October 1, 2026' },
  { acceptedAt: 'bad' }, { endedAt: undefined }, { outcome: 'ACCEPTED' }, { outcome: 'ENDED' },
  { outcome: 'MISSED', endedAt: createdAt, direction: 'OUTGOING' },
  { outcome: 'UNANSWERED', endedAt: createdAt }, { participants: [] }, { participants: null },
  { participants: [entry.participants[1], entry.participants[0]] },
  { participants: [entry.participants[0], { ...entry.participants[1], role: 'CALLER' }] },
  { participants: [entry.participants[0], { ...entry.participants[1], userId: randomUUID() }] },
  { participants: [{ ...entry.participants[0], initiatedAt: null }, entry.participants[1]] },
]) await invalidResponse(page([{ ...entry, ...change }]));
for (const value of [null, [], {}, 'bad']) await invalidResponse(page([value]));

response = { status: 200, data: page([{ ...entry, signal: 'private', participants: entry.participants.map(p => ({ ...p, private: true })) }]) };
assert.deepEqual(json(await api.getCallHistory(query, signal)), page());
passed++;

const cursor = 'opaque.A+B/=?%';
response = { status: 200, data: page([], cursor, true) };
assert.deepEqual(json(await api.getCallHistory({ ...query, conversationId: entry.conversationId, cursor }, signal)), page([], cursor, true));
assert.equal(received[0], `/conversations/${entry.conversationId}/calls/history`);
assert.deepEqual(json(received[1].params), { month: query.month, limit: 50, cursor });
passed++;
await invalidResponse(page(), { ...query, conversationId: randomUUID() });

const detailQuery = { actorId, conversationId: entry.conversationId, callId: entry.callId };
response = { status: 200, data: entry };
assert.deepEqual(json(await api.getCallHistoryDetail(detailQuery, signal)), entry);
assert.equal(received[0], `/conversations/${entry.conversationId}/calls/${entry.callId}/history`);
assert.equal(received[1].signal, signal);
assert.equal(received[1].headers['Cache-Control'], 'no-store');
assert.equal(received[1].params, undefined);
passed++;
for (const change of [{ conversationId: randomUUID() }, { callId: randomUUID() }, { calleeId: randomUUID() }]) {
  response = { status: 200, data: { ...entry, ...change } };
  await assert.rejects(api.getCallHistoryDetail(detailQuery, signal), error => error.code === 'INVALID_RESPONSE');
  passed++;
}

for (const operation of [() => api.getCallHistory(query, signal), () => api.getCallHistoryDetail(detailQuery, signal)]) {
  for (const error of [Object.assign(new Error('HTTP failure'), { status: 403 }), new Error('offline'), new DOMException('Aborted', 'AbortError')]) {
    failure = error;
    await assert.rejects(operation(), caught => caught === error);
    passed++;
  }
}
failure = undefined;
for (const change of [{ actorId: zeroId }, { actorId: 'bad' }, { month: '2026-00' }, { month: '2026-13' },
  { month: '2026-1' }, { month: '1969-12' }, { conversationId: '../private' }, { conversationId: '' }, { cursor: '' }, { cursor: 'x'.repeat(1025) }]) {
  const before = requests;
  await assert.rejects(api.getCallHistory({ ...query, ...change }, signal), error => error.code === 'INVALID');
  assert.equal(requests, before);
  passed++;
}
for (const change of [{ actorId: 'bad' }, { conversationId: zeroId }, { callId: '../private' }]) {
  const before = requests;
  await assert.rejects(api.getCallHistoryDetail({ ...detailQuery, ...change }, signal), error => error.code === 'INVALID');
  assert.equal(requests, before);
  passed++;
}

function completed(outcome, direction = 'INCOMING') {
  const acceptedAt = ['ACCEPTED', 'ENDED'].includes(outcome) ? '2026-10-01T10:00:02.123456789Z' : null;
  const endedAt = ['RINGING', 'ACCEPTED'].includes(outcome) ? null : '2026-10-01T10:00:03Z';
  const callerId = direction === 'OUTGOING' ? actorId : entry.callerId;
  const calleeId = direction === 'OUTGOING' ? entry.callerId : actorId;
  return { ...entry, callerId, calleeId, outcome, direction, acceptedAt, endedAt, participants: [
    { userId: callerId, role: 'CALLER', initiatedAt: createdAt, acceptedAt: null },
    { userId: calleeId, role: 'CALLEE', initiatedAt: null, acceptedAt },
  ] };
}
for (const direction of ['INCOMING', 'OUTGOING']) {
  for (const outcome of ['RINGING', 'ACCEPTED', 'CANCELLED', 'DECLINED', 'ENDED', 'FAILED', direction === 'INCOMING' ? 'MISSED' : 'UNANSWERED']) {
    const value = completed(outcome, direction);
    response = { status: 200, data: page([value]) };
    assert.deepEqual(json(await api.getCallHistory(query, signal)), page([value]));
    passed++;
  }
}
const ended = completed('ENDED');
for (const change of [{ acceptedAt: '2026-10-01T09:59:59Z' }, { endedAt: createdAt },
  { acceptedAt: '2026-10-01T24:00:00Z' }, { createdAt: '2026-10-01T10:00:00+00:00' },
  { outcome: 'CANCELLED' }, { outcome: 'DECLINED' }, { outcome: 'MISSED' }]) await invalidResponse(page([{ ...ended, ...change }]));

const sharedCallId = [entry, { ...entry, conversationId: randomUUID() }];
response = { status: 200, data: page(sharedCallId) };
assert.deepEqual(json(await api.getCallHistory(query, signal)), page(sharedCallId));
passed++;
response = { status: 200, data: page(Array.from({ length: 50 }, () => ({ ...entry, callId: randomUUID() })), 'x'.repeat(1024), true) };
assert.equal((await api.getCallHistory(query, signal)).content.length, 50);
passed++;

for (const [operation, mutable] of [
  [scope => api.getCallHistory(scope, signal), { ...query }],
  [scope => api.getCallHistoryDetail(scope, signal), { ...detailQuery }],
]) {
  response = { status: 200, data: 'month' in mutable ? page() : entry };
  const pending = operation(mutable);
  mutable.actorId = randomUUID();
  await pending;
  passed++;
}

console.log(`Call history API: ${passed} checks passed`);
