import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
const key = { conversationId: '00000000-0000-0000-0000-000000000001', messageId: '00000000-0000-0000-0000-000000000002', messageBucket: '2026-10-23-00:00' };
const item = { attachmentId: '00000000-0000-0000-0000-000000000003', assetId: '00000000-0000-0000-0000-000000000004',
  fileName: 'image.png', mimeType: 'image/png', byteSize: 64, width: 100, height: 80, durationMs: null, spoiler: true,
  status: 'READY', url: 'https://cdn.example/image.png', thumbnailUrl: null };
let data = { ...key, content: [item], nextCursor: null, hasNext: false }, fail = false;
const requests = [], api = {};
const code = ts.transpileModule(await readFile(new URL('../src/features/messenger/api/message-attachments.api.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
vm.runInNewContext(`(function(exports,require){${code}})`, { URL })(api, () => ({ __esModule: true, default: { get: async (path, config) => {
  requests.push({ path, config }); if (fail) throw new Error('store unavailable'); return { data };
} } }));
const controller = new AbortController();
const page = await api.getMessageAttachments(key, null, controller.signal);
assert.equal(page.content[0].url, item.url); assert.equal(page.content[0].spoiler, true);
assert.equal(requests[0].config.signal, controller.signal); assert.equal(requests[0].config.params.bucket, key.messageBucket);
assert.equal(requests[0].config.headers['Cache-Control'], 'no-store');
page.content[0].fileName = 'changed'; assert.equal(item.fileName, 'image.png');
const canonical = data;
for (const change of [{ conversationId: key.messageId }, { messageBucket: 'other' }, { messageId: key.conversationId },
  { content: [{ ...item, url: 'javascript:alert(1)' }] }, { content: [{ ...item, url: 'https://user:pass@cdn.example/a' }] },
  { content: [{ ...item, status: 'UNAVAILABLE', url: item.url }] }, { content: [{ ...item, byteSize: -1 }] },
  { content: [{ ...item, width: 0 }] }, { content: [item, item] }, { hasNext: true }, { nextCursor: item.attachmentId }]) {
  data = { ...canonical, ...change }; await assert.rejects(api.getMessageAttachments(key, null));
}
data = { ...canonical, content: [{ ...item, status: 'UNAVAILABLE', url: null, thumbnailUrl: null }] };
assert.equal((await api.getMessageAttachments(key, null)).content[0].status, 'UNAVAILABLE');
data = { ...canonical, hasNext: true, nextCursor: item.attachmentId };
assert.equal((await api.getMessageAttachments(key, null)).nextCursor, item.attachmentId);
await assert.rejects(api.getMessageAttachments(key, item.attachmentId));
data = { ...key, content: [], hasNext: false, nextCursor: null };
assert.equal((await api.getMessageAttachments(key, null)).content.length, 0);
const beforeInvalid = requests.length;
await assert.rejects(api.getMessageAttachments({ ...key, messageId: '../other' }, null));
assert.equal(requests.length, beforeInvalid);
fail = true; await assert.rejects(api.getMessageAttachments(key, null), /store unavailable/);
console.log(JSON.stringify({ passed: 7, boundary: 'Production message attachment HTTP adapter with controlled responses; no live assets' }));
