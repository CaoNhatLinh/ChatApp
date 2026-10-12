import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/features/notifications/model/notification.store.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const listeners = new Map();
const exports = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`, {})(exports, name => {
  if (name === 'zustand') return require(name);
  if (name.endsWith('/notifications.api')) return {};
  if (name.endsWith('/realtime-service')) return { realtimeService: { subscribe(destination, callback) {
    listeners.set(destination, callback);
    return () => listeners.delete(destination);
  } } };
  if (name.endsWith('/logger')) return { logger: { warn() {} } };
  if (name.endsWith('/i18n')) return { localizeText: text => text };
  if (name.endsWith('/user-facing-error')) return {};
  throw new Error(`Unexpected dependency: ${name}`);
});
const store = exports.useNotificationStore;
store.getState().connectRealtime('actor');
const emit = listeners.get('/user/queue/notifications');
for (const type of ['JOIN_REQUEST_APPROVED', 'JOIN_REQUEST_DECLINED']) {
  emit({ notificationId: type, userId: 'actor', type, title: 'Decision', body: 'Join result',
    isRead: false, createdAt: new Date().toISOString(), metadata: { conversationId: 'room' } });
}
assert.equal(store.getState().notifications.length, 2);
assert.equal(store.getState().unreadCount, 2);
store.getState().disconnectRealtime();
assert.equal(listeners.size, 0);
const copySource = await readFile(new URL('../src/features/notifications/model/notification-copy.ts', import.meta.url), 'utf8');
const copyCode = ts.transpileModule(copySource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const copyExports = {};
vm.runInNewContext(`(function(exports) { ${copyCode} })`, {})(copyExports);
const approval = { type: 'JOIN_REQUEST_APPROVED', title: 'server title', body: 'server body' };
assert.equal(copyExports.getNotificationCopy(approval, 'en').title, 'Your join request was approved');
assert.equal(copyExports.getNotificationCopy(approval, 'vi').title, 'Bạn đã được duyệt vào phòng');
assert.equal(copyExports.getNotificationCopy({ ...approval, type: 'JOIN_REQUEST_DECLINED' }, 'en').title, 'Your join request was declined');
assert.equal(copyExports.getNotificationCopy({ ...approval, type: 'MESSAGE' }, 'en').body, 'server body');
console.log(JSON.stringify({ passed: 7, boundary: 'Production notification store and localized decision copy; user content is unchanged' }));
