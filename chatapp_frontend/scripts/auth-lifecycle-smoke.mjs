import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import axios, { AxiosError } from 'axios';
import * as zustand from 'zustand';
import ts from 'typescript';

const compile = async (path) => ts.transpileModule(await readFile(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const [storeCode, tokenCode] = await Promise.all([
  compile('../src/features/auth/model/auth.store.ts'), compile('../src/shared/auth/access-token.ts'),
]);
const user = { userId: 'member-1', userName: 'linh', displayName: 'Linh' };
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const unavailable = () => new AxiosError('Unavailable', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 503 });

function harness(api) {
  const context = vm.createContext({ Error, document: { cookie: 'novachat_session=1' } });
  const load = (code, imports = {}) => {
    const exports = {};
    vm.runInContext(`(function(exports, require) { ${code}\n})`, context)(exports, (name) => {
      assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
      return imports[name];
    });
    return exports;
  };
  const tokens = load(tokenCode);
  const resetStore = { getState: () => ({ reset() {}, resetState() {}, clearPresences() {}, disconnectRealtime() {}, setMyStatusFromServer() {} }) };
  const store = load(storeCode, {
    zustand, axios,
    '@/shared/websocket/websocketService': { disconnectWebSocket() {} },
    '@/features/auth/api/auth.api': api,
    '@/features/relationships/model/friend.store': { useFriendStore: resetStore },
    '@/features/messenger/model/messenger.store': { useMessengerStore: resetStore },
    '@/features/notifications/model/notification.store': { useNotificationStore: resetStore },
    '@/features/presence/model/presence.store': { usePresenceStore: resetStore },
    '@/shared/lib/logger': { logger: { warn() {}, debug() {}, error() {} } },
    '@/shared/auth/access-token': tokens,
  }).useAuthStore;
  return { store, tokens };
}

let checks = 0;
{
  let attempts = 0;
  const app = harness({
    refreshAccessToken: async () => { if (++attempts === 1) throw unavailable(); return 'retry-token'; },
    getCurrentUser: async () => user,
  });
  await app.store.getState().initializeAuth();
  assert.equal(app.tokens.hasSessionHint(), true, 'Transient init failure must keep the refresh cookie hint');
  assert.equal(app.store.getState().initializationError, 'unavailable');
  assert.equal(app.store.getState().loading, false);
  await app.store.getState().initializeAuth();
  assert.equal(app.store.getState().user, user);
  assert.equal(app.store.getState().initializationError, null);
  checks += 1;
}
{
  const refresh = deferred();
  const app = harness({ refreshAccessToken: () => refresh.promise, getCurrentUser: async () => user });
  const init = app.store.getState().initializeAuth();
  app.store.getState().logout();
  refresh.resolve('late-token');
  await init;
  assert.equal(app.tokens.getAccessToken(), undefined, 'Logout must win over an in-flight refresh');
  assert.equal(app.store.getState().user, null);
  assert.equal(app.store.getState().loading, false);
  checks += 1;
}
{
  const profile = deferred();
  const app = harness({ refreshAccessToken: async () => 'token', getCurrentUser: () => profile.promise });
  app.tokens.setAccessToken('token');
  const init = app.store.getState().initializeAuth();
  app.store.getState().logout();
  profile.resolve(user);
  await init;
  assert.equal(app.store.getState().user, null, 'Logout must win over a delayed /me response');
  checks += 1;
}
for (const outcome of ['success', 'failure']) {
  const oldProfile = deferred();
  let calls = 0;
  const currentUser = { ...user, userId: 'member-2' };
  const app = harness({ refreshAccessToken: async () => 'token', getCurrentUser: () => ++calls === 1 ? oldProfile.promise : Promise.resolve(currentUser) });
  const previousLogin = app.store.getState().login('previous-token');
  const oldResult = assert.rejects(previousLogin);
  await app.store.getState().login('current-token');
  if (outcome === 'success') oldProfile.resolve(user);
  else oldProfile.reject(unavailable());
  await oldResult;
  assert.equal(app.store.getState().user, currentUser);
  assert.equal(app.tokens.getAccessToken(), 'current-token');
  checks += 1;
}
{
  let refreshCount = 0;
  const refresh = deferred();
  const app = harness({ refreshAccessToken: () => { refreshCount += 1; return refresh.promise; }, getCurrentUser: async () => user });
  const first = app.store.getState().initializeAuth();
  const second = app.store.getState().initializeAuth();
  refresh.resolve('shared-token');
  await Promise.all([first, second]);
  assert.equal(refreshCount, 1);
  checks += 1;
}
{
  const app = harness({ refreshAccessToken: async () => { throw new AxiosError('Expired', 'ERR_BAD_RESPONSE', undefined, undefined, { status: 401 }); }, getCurrentUser: async () => user });
  await app.store.getState().initializeAuth();
  assert.equal(app.tokens.hasSessionHint(), false);
  assert.equal(app.store.getState().initializationError, null);
  assert.equal(app.store.getState().user, null);
  checks += 1;
}
console.log(JSON.stringify({ passed: checks, boundary: 'Production Zustand auth lifecycle, controlled API responses' }, null, 2));
