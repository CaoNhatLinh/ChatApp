import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/notifications/model/notification-copy.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(`(function(exports) { ${code} })`)(exports);
const sticker = { type: 'MESSAGE', title: 'Tên người gửi', body: 'Sticker', metadata: { messageType: 'STICKER' } };
for (const [locale, expected] of [['vi', 'Đã gửi sticker.'], ['en', 'Sent a sticker.']]) {
  const copy = exports.getNotificationCopy(sticker, locale);
  assert.equal(copy.title, sticker.title, 'sender name is not translated');
  assert.equal(copy.body, expected, `structured sticker copy in ${locale}`);
}
assert.equal(exports.getNotificationCopy({ ...sticker, type: 'MENTION' }, 'vi').body, 'Đã gửi sticker.');
assert.equal(exports.getNotificationCopy({ ...sticker, metadata: { messageType: 'TEXT' } }, 'en').body, 'Sticker', 'user-authored text is not inferred as a sticker');
assert.equal(exports.getNotificationCopy({ ...sticker, metadata: undefined, body: 'Nội dung của người dùng' }, 'en').body, 'Nội dung của người dùng');
assert.equal(exports.getNotificationCopy({ ...sticker, type: 'SYSTEM', body: 'System message' }, 'vi').body, 'System message');
assert.equal(exports.getNotificationCopy({ ...sticker, body: '' }, 'vi').body, '', 'server-redacted preview is not recreated from metadata');
assert.equal(exports.getNotificationCopy({ ...sticker, type: 'JOIN_REQUEST_APPROVED' }, 'en').title, 'Your join request was approved');
const gif = { ...sticker, body: 'GIF', metadata: { messageType: 'GIF' } };
assert.equal(exports.getNotificationCopy(gif, 'vi').body, 'Đã gửi GIF.');
assert.equal(exports.getNotificationCopy(gif, 'en').body, 'Sent a GIF.');
assert.equal(exports.getNotificationCopy({ ...gif, body: '' }, 'vi').body, '', 'redacted GIF preview stays redacted');
assert.equal(exports.getNotificationCopy({ ...gif, metadata: { messageType: 'TEXT' } }, 'vi').body, 'GIF', 'literal user text GIF is not translated');
console.log(JSON.stringify({ passed: 12, boundary: 'Production pure copy model, no browser/provider/datastore' }));
