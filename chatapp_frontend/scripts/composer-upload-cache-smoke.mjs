import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';

const stored = new Map();
const sessionStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: key => stored.delete(key),
};
async function load(name) {
  const source = await readFile(new URL(`../src/features/messenger/model/${name}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const api = {};
  vm.runInNewContext(`(function(exports) { ${code} })`, {
    AbortController, DOMException, TextEncoder, crypto, window: { sessionStorage }, sessionStorage,
  })(api);
  return api;
}
const { createComposerUploadCache, ComposerUploadUnavailableError } = await load('composerUploadCache');
const { createComposerUploadIdentity } = await load('composerUploadIdentity');
const { checkPendingUploadReceipts } = await load('checkPendingUploadReceipts');
let scope = 0;
function createCache(upload, { room = String(++scope), actor = 'actor', inspect = async () => null } = {}) {
  return createComposerUploadCache(upload, { identity: createComposerUploadIdentity(actor, room), inspect });
}
const file = new File(['one'], 'one.png', { type: 'image/png' });
const calls = [];
const cache = createCache(async files => {
  calls.push(files);
  return [{ attachmentId: 'attachment-a', assetId: 'asset-a', fileName: 'one.png', fileSize: 3, url: 'https://example.test/a.png' }];
});
const first = await cache.resolve([file]);
const retry = await cache.resolve([file]);
assert.equal(calls.length, 1, 'confirmed upload is reused after message-send failure');
assert.equal(retry[0].assetId, first[0].assetId);
retry[0].assetId = 'mutated';
assert.equal((await cache.resolve([file]))[0].assetId, 'asset-a', 'callers cannot mutate cached facts');
cache.forget(file);
await cache.resolve([file]);
assert.equal(calls.length, 2, 'removing a selection releases its cache entry');

const second = new File(['two'], 'two.png', { type: 'image/png' });
let failSecond = true;
const partialCalls = [];
const partial = createCache(async ([item]) => {
  partialCalls.push(item);
  if (item === second && failSecond) throw new Error('second upload failed');
  return [{ ...first[0], fileName: item.name, assetId: item === file ? 'first' : 'second' }];
});
await assert.rejects(partial.resolve([file, second]), /second upload failed/);
failSecond = false;
const recovered = await partial.resolve([file, second]);
assert.equal(partialCalls.filter(item => item === file).length, 1, 'partial retry does not upload the first file again');
assert.equal(recovered[1].assetId, 'second');
const [firstUploadId, secondUploadId] = partial.getConfirmedUploadIds([file, second]);
assert.notEqual(firstUploadId, secondUploadId);
assert.deepEqual([...partial.getConfirmedUploadIds([second, file])], [secondUploadId, firstUploadId]);

let release;
let signal;
let pendingCalls = 0;
let started;
const waitForUpload = new Promise(resolve => { started = resolve; });
const pending = createCache(async (files, uploadSignal) => {
  pendingCalls++; signal = uploadSignal;
  started();
  return await new Promise(resolve => { release = resolve; });
});
const operation = pending.resolve([file]);
const concurrent = pending.resolve([file]);
await waitForUpload;
assert.equal(pendingCalls, 1);
pending.dispose();
assert.equal(signal.aborted, true);
release(first);
await assert.rejects(operation, error => error.name === 'AbortError');
await assert.rejects(concurrent, error => error.name === 'AbortError');
await assert.rejects(pending.resolve([file]), error => error.name === 'AbortError');

const invalid = createCache(async () => []);
await assert.rejects(invalid.resolve([file]), /exactly one/);
await assert.rejects(cache.resolve([file, file]), /Invalid composer file selection/);
let isolatedCalls = 0;
const isolated = createCache(async () => { isolatedCalls++; return first; });
await isolated.resolve([file]);
assert.equal(isolatedCalls, 1, 'the same File does not reuse another composer scope cache');

let uploadId;
const lost = createCache(async (_files, _signal, [id]) => {
  uploadId = id;
  throw new Error('lost response');
}, { room: 'reload-room' });
await assert.rejects(lost.resolve([file]), /lost response/);
lost.dispose();
const reselected = new File(['one'], 'one.png', { type: 'image/png' });
const reloaded = createCache(async () => { throw new Error('confirmed upload must not POST again'); }, {
  room: 'reload-room', inspect: async id => {
    assert.equal(id, uploadId);
    return { status: 'READY', file: first[0] };
  },
});
assert.equal((await reloaded.resolve([reselected]))[0].assetId, 'asset-a');
reloaded.forget(reselected);
const fresh = createCache(async (_files, _signal, [id]) => {
  assert.notEqual(id, uploadId, 'confirmed send releases the exact persistent identity');
  return first;
}, { room: 'reload-room' });
await fresh.resolve([reselected]);

const duplicateIds = [];
const duplicate = createCache(async (_files, _signal, [id]) => {
  duplicateIds.push(id);
  return first;
});
await duplicate.resolve([file, reselected]);
assert.equal(new Set(duplicateIds).size, 2, 'separate same-content selections get distinct identities');

const retryIds = [];
const pendingIntent = createCache(async (_files, _signal, [id]) => {
  retryIds.push(id);
  if (retryIds.length === 1) throw new Error('lost response');
  return first;
}, { inspect: async id => {
  assert.equal(id, retryIds[0]);
  return { status: 'PENDING', file: null };
} });
await assert.rejects(pendingIntent.resolve([file]), /lost response/);
await pendingIntent.resolve([file]);
assert.deepEqual(retryIds, [retryIds[0], retryIds[0]], 'pending recovery only POSTs with the original ID');

const deniedRoom = 'denied-room';
const old = createCache(async () => { throw new Error('lost response'); }, { room: deniedRoom });
await assert.rejects(old.resolve([file]), /lost response/);
old.dispose();
const denied = createCache(async () => { throw new Error('must not POST after lookup denial'); }, {
  room: deniedRoom, inspect: async () => { throw new Error('lookup denied'); },
});
await assert.rejects(denied.resolve([reselected]), /lookup denied/);

const otherActor = createCache(async (_files, _signal, [id]) => {
  assert.notEqual(id, uploadId);
  return first;
}, { room: 'reload-room', actor: 'other-actor', inspect: async () => { throw new Error('must not inspect across accounts'); } });
await otherActor.resolve([reselected]);
assert.ok([...stored.keys()].every(key => !key.includes('one.png') && !key.includes('two.png')));

for (const status of ['QUARANTINED', 'DELETING', 'DELETED']) {
  let originalId;
  const original = createCache(async (_files, _signal, [id]) => {
    originalId = id;
    throw new Error('lost response');
  }, { room: status });
  await assert.rejects(original.resolve([file]), /lost response/);
  original.dispose();
  let retries = 0;
  const terminal = createCache(async (_files, _signal, [id]) => {
    retries++;
    assert.notEqual(id, originalId);
    return first;
  }, { room: status, inspect: async id => {
    assert.equal(id, originalId);
    return { status, file: null };
  } });
  await assert.rejects(terminal.resolve([reselected]), error =>
    error instanceof ComposerUploadUnavailableError && error.file === reselected && error.status === status);
  assert.equal(retries, 0, 'terminal state must not implicitly start a new upload');
  if (status === 'DELETED') {
    terminal.forget(reselected);
    await terminal.resolve([reselected]);
    assert.equal(retries, 1);
  } else {
    terminal.forget(reselected);
    await assert.rejects(terminal.resolve([file]), error =>
      error instanceof ComposerUploadUnavailableError && error.status === status);
    assert.equal(retries, 0, 'reselecting a blocked file keeps the same upload identity');
  }
}

let staleUploads = 0;
let staleId;
let inspection = null;
const stale = createCache(async (_files, _signal, [id]) => {
  staleUploads++;
  staleId = id;
  return first;
}, { inspect: async id => {
  assert.equal(id, staleId);
  return inspection;
} });
await stale.resolve([file]);
stale.invalidateConfirmed([file]);
await assert.rejects(stale.resolve([file]), /could not be revalidated/);
inspection = { status: 'PENDING', file: null };
await assert.rejects(stale.resolve([file]), /could not be revalidated/);
inspection = { status: 'READY', file: { ...first[0], assetId: 'unexpected' } };
await assert.rejects(stale.resolve([file]), /could not be revalidated/);
inspection = { status: 'READY', file: first[0] };
assert.equal((await stale.resolve([file]))[0].assetId, first[0].assetId);
assert.equal(staleUploads, 1, 'a confirmed file can never be silently uploaded again after invalidation');
stale.invalidateConfirmed([file]);
inspection = { status: 'DELETED', file: null };
await assert.rejects(stale.resolve([file]), error =>
  error instanceof ComposerUploadUnavailableError && error.file === file && error.status === 'DELETED');
assert.equal(staleUploads, 1);

const receiptIds = [firstUploadId, secondUploadId];
const receiptRequest = { attachments: recovered };
const checkedIds = [];
const readyReceipt = uploadId => ({ status: 'READY', uploadId, file: recovered[receiptIds.indexOf(uploadId)] });
const controller = new AbortController();
const check = inspect => checkPendingUploadReceipts(receiptRequest, receiptIds, inspect, controller.signal);
assert.equal(await check(async uploadId => { checkedIds.push(uploadId); return readyReceipt(uploadId); }), 'ready');
assert.deepEqual(checkedIds, receiptIds);
for (const status of ['QUARANTINED', 'DELETING', 'DELETED']) {
  assert.equal(await check(async uploadId => uploadId === firstUploadId
    ? { status, uploadId, file: null } : readyReceipt(uploadId)), 'unavailable');
}
for (const unknownReceipt of [
  async () => null,
  async () => { throw new Error('network down'); },
  async uploadId => ({ status: 'PENDING', uploadId, file: null }),
  async uploadId => ({ ...readyReceipt(uploadId), file: { ...readyReceipt(uploadId).file, assetId: 'wrong' } }),
  async uploadId => ({ ...readyReceipt(uploadId), file: { ...readyReceipt(uploadId).file, attachmentId: 'wrong' } }),
  async () => ({ status: 'DELETED', uploadId: secondUploadId, file: null }),
]) {
  assert.equal(await check(async uploadId => uploadId === firstUploadId
    ? unknownReceipt(uploadId) : readyReceipt(uploadId)), 'unconfirmed');
}
assert.equal(await checkPendingUploadReceipts(receiptRequest, [], async () => {
  assert.fail('An incomplete identity list cannot be inspected');
}, controller.signal), 'unconfirmed');
controller.abort();
await assert.rejects(check(async () => assert.fail('An aborted retry cannot inspect an upload')), { name: 'AbortError' });

console.log(JSON.stringify({ passed: 30, boundary: 'Scoped upload cache, same-tab reload recovery, and frozen bubble receipts with controlled IO' }));
