import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const evaluate = async (path, dependencies = {}) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(exports,require){${code}})`, { AbortController })(exports, name => {
    assert.ok(name in dependencies, `unexpected dependency ${name}`); return dependencies[name];
  });
  return exports;
};
const channel = await evaluate('../src/features/calls/model/call-command-channel.ts');
let respond, calls;
const model = await evaluate('../src/features/calls/model/incoming-call-discovery.ts', {
  '../api/incoming-calls.api': { getIncomingCalls: async (query, signal) => { calls.push({ query, signal }); return respond(query, signal); } },
  './call-command-channel': channel,
});
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const page = (content = [], nextCursor = null) => ({ content, nextCursor, hasNext: nextCursor !== null });
let passed = 0;
const fixture = () => {
  calls = []; const received = [], statuses = []; let current = true;
  const discovery = new model.IncomingCallDiscovery('actor', { receive: call => received.push(call), status: status => statuses.push(status), current: () => current });
  return { discovery, received, statuses, invalidate: () => { current = false; } };
};

{
  const test = fixture(); const snapshot = { callId: 'first' };
  respond = async () => page([snapshot]); test.discovery.refresh(); await settle();
  assert.deepEqual(test.received, [snapshot]); assert.deepEqual(test.statuses, ['loading', 'ready']);
  assert.equal(calls[0].query.actorId, 'actor'); assert.equal(calls[0].query.cursor, undefined);
  assert.equal(calls[0].signal.aborted, false); passed++;
}
{
  const test = fixture();
  respond = async query => query.cursor === undefined ? page([], 'next') : page([{ callId: 'later' }]);
  test.discovery.refresh(); await settle();
  assert.deepEqual(calls.map(call => call.query.cursor), [undefined, 'next']);
  assert.equal(test.received[0].callId, 'later'); assert.equal(test.statuses.at(-1), 'ready'); passed++;
}
{
  const test = fixture(); let finishOld;
  respond = () => new Promise(resolve => { finishOld = resolve; });
  test.discovery.refresh(); const oldSignal = calls[0].signal;
  respond = async () => page([{ callId: 'current' }]); test.discovery.refresh(); await settle();
  assert.equal(oldSignal.aborted, true); finishOld(page([{ callId: 'obsolete' }])); await settle();
  assert.deepEqual(test.received.map(call => call.callId), ['current']); assert.equal(test.statuses.at(-1), 'ready'); passed++;
}
{
  const test = fixture(); let failOld;
  respond = () => new Promise((_, reject) => { failOld = reject; });
  test.discovery.refresh(); respond = async () => page(); test.discovery.refresh(); await settle();
  failOld(new Error('late failure')); await settle();
  assert.equal(test.statuses.at(-1), 'ready'); passed++;
}
{
  const test = fixture(); let finish;
  respond = () => new Promise(resolve => { finish = resolve; }); test.discovery.refresh();
  test.discovery.dispose(); finish(page([{ callId: 'disposed' }])); await settle();
  assert.equal(test.received.length, 0); assert.deepEqual(test.statuses, ['loading']);
  assert.equal(calls[0].signal.aborted, true); test.discovery.refresh(); assert.equal(calls.length, 1); passed++;
}
{
  const test = fixture(); let finish;
  respond = () => new Promise(resolve => { finish = resolve; }); test.discovery.refresh();
  test.invalidate(); finish(page([{ callId: 'old-session' }], 'next')); await settle();
  assert.equal(test.received.length, 0); assert.equal(calls.length, 1); assert.deepEqual(test.statuses, ['loading']); passed++;
}
{
  const test = fixture(); respond = async query => page([], query.cursor === 'B' ? 'A' : query.cursor === 'A' ? 'B' : 'A');
  test.discovery.refresh(); await settle();
  assert.equal(test.statuses.at(-1), 'error'); assert.equal(calls.length, 3); passed++;
}
{
  const test = fixture(); respond = async () => { throw new Error('expired cursor or store failure'); };
  test.discovery.refresh(); await settle(); assert.equal(test.statuses.at(-1), 'error');
  respond = async () => page(); test.discovery.refresh(); await settle();
  assert.equal(calls.at(-1).query.cursor, undefined); assert.equal(test.statuses.at(-1), 'ready'); passed++;
}
{
  const test = fixture(); respond = async query => page([], String(Number(query.cursor ?? 0) + 1));
  test.discovery.refresh(); await settle();
  assert.equal(calls.length, 8); assert.equal(test.statuses.at(-1), 'more');
  respond = async () => page([{ callId: 'continued' }]); test.discovery.loadMore(); await settle();
  assert.equal(calls.at(-1).query.cursor, '8'); assert.equal(test.statuses.at(-1), 'ready');
  assert.equal(test.received[0].callId, 'continued'); passed++;
}
{
  const test = fixture(); let finish;
  respond = () => new Promise(resolve => { finish = resolve; });
  test.discovery.refresh(); test.discovery.loadMore(); test.discovery.loadMore();
  assert.equal(calls.length, 1, 'continuation cannot overlap an in-flight lookup');
  finish(page()); await settle(); test.discovery.loadMore();
  assert.equal(calls.length, 1, 'an exhausted lookup has no continuation'); passed++;
}
{
  const test = fixture(); test.invalidate();
  respond = async () => page([{ callId: 'invalidated-before-start' }]);
  test.discovery.refresh(); test.discovery.loadMore(); await settle();
  assert.equal(calls.length, 0); assert.deepEqual(test.statuses, []); passed++;
}
{
  const test = fixture(); respond = async query => page([], String(Number(query.cursor ?? 0) + 1));
  test.discovery.refresh(); await settle();
  for (let batch = 1; batch < 17; batch++) { test.discovery.loadMore(); await settle(); }
  assert.equal(calls.length, 129, 'cursor memory and traversals have an explicit upper bound');
  assert.equal(test.statuses.at(-1), 'error', 'hitting a guard is incomplete, not empty success');
  respond = async () => page(); test.discovery.refresh(); await settle();
  assert.equal(calls.at(-1).query.cursor, undefined); assert.equal(test.statuses.at(-1), 'ready'); passed++;
}
console.log(JSON.stringify({ passed, boundary: 'Actual incoming discovery controller; controlled pages, deferred transport and scope changes' }));
