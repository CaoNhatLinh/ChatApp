import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/calls/model/call-history-reader.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(`(function(exports){${code}})`, { AbortController })(exports);
const { CallHistoryReader } = exports;
const page = (content = [], nextCursor = null) => ({ content, nextCursor, hasNext: nextCursor !== null });
const item = (callId = 'a', conversationId = 'room', version = 1) => ({ callId, conversationId, version });
let passed = 0;
function fixture() {
  let current = true, state, list = async () => page(), detail = async query => item(query.callId, query.conversationId);
  const reads = [];
  const reader = new CallHistoryReader({ actorId: 'actor', month: '2026-10' }, {
    current: () => current, changed: value => { state = value; },
    list: async (query, signal) => { reads.push({ query, signal }); return list(query, signal); },
    detail: async (query, signal) => { reads.push({ query, signal }); return detail(query, signal); },
  });
  return { reader, reads, get state() { return state; }, invalidate: () => { current = false; },
    list: value => { list = value; }, detail: value => { detail = value; } };
}
{
  const test = fixture();
  test.list(async () => page([item()], 'next'));
  await test.reader.refresh();
  assert.equal(test.state.items.length, 1);
  assert.equal(test.state.hasNext, true);
  assert.equal(test.reads[0].query.month, '2026-10');
  passed++;
}
{
  const test = fixture();
  test.list(async query => query.cursor ? page([item('a', 'room', 2), item('a', 'other'), item('b')]) : page([item()], 'next'));
  await test.reader.refresh(); await test.reader.loadMore();
  assert.equal(test.state.items.length, 3);
  assert.equal(test.state.items[0].version, 2);
  assert.equal(test.reads[1].query.cursor, 'next');
  passed++;
}
{
  const test = fixture();
  test.list(async query => query.cursor ? page([item('a', 'room', 1)]) : page([item('a', 'room', 3)], 'next'));
  await test.reader.refresh(); await test.reader.loadMore();
  assert.equal(test.state.items[0].version, 3);
  passed++;
}
{
  const test = fixture(); test.list(async () => page([], 'next'));
  await test.reader.refresh();
  assert.equal(test.reads.length, 1, 'filtered empty pages wait for explicit continuation');
  await test.reader.loadMore();
  assert.equal(test.state.limited, true, 'cursor cycle stops without claiming complete history');
  assert.equal(test.state.hasNext, false);
  passed++;
}
{
  const test = fixture(); let finish;
  test.list(() => new Promise(resolve => { finish = resolve; }));
  const old = test.reader.refresh();
  test.list(async () => page([item('new')])); await test.reader.refresh();
  finish(page([item('old')])); await old;
  assert.equal(test.reads[0].signal.aborted, true);
  assert.equal(test.state.items[0].callId, 'new');
  passed++;
}
for (const invalidate of ['invalidate', 'dispose']) {
  for (const fails of [false, true]) {
    const test = fixture(); let finish;
    test.list(() => new Promise((resolve, reject) => { finish = fails ? reject : resolve; }));
    const pending = test.reader.refresh(), state = test.state;
    if (invalidate === 'dispose') test.reader.dispose(); else test.invalidate();
    finish(fails ? new Error('late') : page([item()])); await pending;
    assert.equal(test.state, state);
    passed++;
  }
}
{
  const test = fixture(); test.list(async () => page([item()], 'next')); await test.reader.refresh();
  await test.reader.openDetail(item());
  assert.equal(test.state.items.length, 0);
  assert.equal(test.state.detail.callId, 'a');
  assert.equal(test.state.selected.callId, 'a');
  await test.reader.reloadCurrent();
  assert.equal(test.reads.at(-1).query.callId, 'a');
  test.reader.back();
  assert.equal(test.state.selected, null);
  assert.equal(test.state.items[0].callId, 'a');
  assert.equal(test.reads.length, 3, 'Back restores loaded results without a head read');
  await test.reader.loadMore();
  assert.equal(test.reads.at(-1).query.cursor, 'next');
  passed++;
}
for (const [status, expected] of [[401, 'forbidden'], [403, 'forbidden'], [404, 'missing'], [400, 'unavailable'], [500, 'unavailable'], [429, 'unavailable'], [undefined, 'unavailable']]) {
  const test = fixture(); test.list(async () => page([item()], 'next')); await test.reader.refresh();
  test.list(async () => { throw { response: { status } }; }); await test.reader.loadMore();
  const retained = status === undefined || status === 500 || status === 429;
  assert.equal(test.state.items.length, retained ? 1 : 0);
  assert.equal(test.state.error, expected);
  assert.equal(test.state.loading, false);
  test.list(async () => page([item('retry')])); await test.reader.reloadCurrent();
  assert.equal(test.reads.at(-1).query.cursor, retained ? 'next' : undefined);
  assert.equal(test.state.items.length, retained ? 2 : 1);
  passed++;
}
{
  const test = fixture(); let finish;
  test.list(async () => page([item()], 'next')); await test.reader.refresh();
  test.detail(() => new Promise(resolve => { finish = resolve; }));
  const pending = test.reader.openDetail(item());
  test.reader.back();
  finish(item('late')); await pending;
  assert.equal(test.reads.at(-1).signal.aborted, true);
  assert.equal(test.state.detail, null);
  assert.equal(test.state.items[0].callId, 'a');
  assert.equal(test.state.hasNext, true);
  passed++;
}
{
  const test = fixture();
  test.list(async () => page([item('cached')])); await test.reader.refresh();
  test.detail(async () => { throw { response: { status: 403 } }; });
  await test.reader.openDetail(item('cached'));
  test.list(async () => page([item('authorized')]));
  test.reader.back();
  assert.equal(test.state.items.length, 0, 'authorization denial invalidates the cached list');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(test.state.items[0].callId, 'authorized');
  passed++;
}
{
  const test = fixture(); let finish;
  test.detail(() => new Promise(resolve => { finish = resolve; }));
  const pending = test.reader.openDetail(item());
  test.list(async () => page([item('list')])); await test.reader.refresh();
  finish(item('old-detail')); await pending;
  assert.equal(test.state.detail, null);
  assert.equal(test.state.items[0].callId, 'list');
  passed++;
}
{
  const test = fixture(); let finish;
  test.list(() => new Promise(resolve => { finish = resolve; }));
  const pending = test.reader.refresh(); await test.reader.loadMore();
  assert.equal(test.reads.length, 1);
  finish(page()); await pending;
  passed++;
}
{
  const test = fixture();
  test.list(async query => page(Array.from({ length: 50 }, (_, n) => item(`${query.cursor ?? 'head'}-${n}`)), `${test.reads.length}`));
  await test.reader.refresh();
  for (let n = 0; n < 6; n++) await test.reader.loadMore();
  assert.equal(test.state.items.length, 250);
  assert.equal(test.state.limited, true);
  assert.equal(test.reads.length, 5);
  passed++;
}
{
  const test = fixture();
  test.list(async () => page(Array.from({ length: 49 }, (_, n) => item(`${test.reads.length}-${n}`)), test.reads.length < 6 ? `${test.reads.length}` : null));
  await test.reader.refresh();
  for (let n = 0; n < 5; n++) await test.reader.loadMore();
  assert.equal(test.state.items.length, 250);
  assert.equal(test.state.limited, true, 'final page exceeding capacity must not claim complete');
  passed++;
}
{
  const test = fixture(); test.list(async () => page([], `${test.reads.length}`));
  await test.reader.refresh();
  for (let n = 0; n < 130; n++) await test.reader.loadMore();
  assert.equal(test.state.limited, true);
  assert.equal(test.reads.length, 129);
  passed++;
}
{
  const test = fixture(); test.detail(async () => { throw { response: { status: 403 } }; });
  await test.reader.openDetail(item());
  assert.equal(test.state.detail, null);
  assert.equal(test.state.error, 'forbidden');
  test.detail(async query => item(query.callId, query.conversationId)); await test.reader.reloadCurrent();
  assert.equal(test.state.detail.callId, 'a');
  passed++;
}
console.log(`Call history reader: ${passed} groups passed`);
