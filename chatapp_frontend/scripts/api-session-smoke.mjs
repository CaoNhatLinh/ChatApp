import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import axios, { AxiosError } from 'axios';
import ts from 'typescript';

// Execute the production interceptor and token store with real Axios. Only the
// transport, browser location/cookie and diagnostic logger are test boundaries.
const compile = async (path) => ts.transpileModule(
  await readFile(new URL(path, import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText;
const [clientCode, tokenCode, authApiCode] = await Promise.all([
  compile('../src/shared/api/apiClient.ts'),
  compile('../src/shared/auth/access-token.ts'),
  compile('../src/features/auth/api/auth.api.ts'),
]);

function harness({ refreshStatus = 200, replayStatus = 200, replayNetworkError = false, refreshWait, onRefresh = () => {}, operationWait, onOperation = () => {} }) {
  const browser = { location: { href: '/app' } };
  const document = { cookie: 'novachat_session=1' };
  const context = vm.createContext({ window: browser, document, Error });
  const load = (code, dependencies = {}) => {
    const exports = {};
    vm.runInContext(`(function(exports, require) { ${code}\n})`, context)(exports, (name) => {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
      return dependencies[name];
    });
    return exports;
  };
  const tokens = load(tokenCode);
  tokens.setAccessToken('expired-token');
  let refreshCount = 0;
  let replayCount = 0;
  const respond = (config, status, data = {}) => {
    if (status === 0) return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
    const response = { config, status, data, statusText: String(status), headers: {} };
    return status >= 400
      ? Promise.reject(new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, undefined, response))
      : Promise.resolve(response);
  };
  const previousAdapter = axios.defaults.adapter;
  axios.defaults.adapter = async (config) => {
    if (config.url === '/auth/refresh') {
      refreshCount += 1;
      onRefresh();
      if (refreshWait) await refreshWait;
      await new Promise((resolve) => setImmediate(resolve));
      return respond(config, refreshStatus, { accessToken: 'renewed-token' });
    }
    onOperation();
    if (operationWait) await operationWait;
    if (config.headers.get('Authorization') === 'Bearer expired-token') return respond(config, 401);
    replayCount += 1;
    return respond(config, replayNetworkError ? 0 : replayStatus);
  };
  let client;
  try {
    client = load(clientCode, {
      axios,
      '../lib/logger': { logger: { debug() {}, warn() {}, error() {} } },
      '../config/runtimeEnv': { runtimeEnv: { apiBaseUrl: 'https://noi.test/api', isDevelopment: false } },
      '../auth/access-token': tokens,
    }).apiClient;
  } finally {
    axios.defaults.adapter = previousAdapter;
  }
  const authApi = load(authApiCode, { '@/shared/api/apiClient': { __esModule: true, default: client } });
  return { client, authApi, tokens, browser, counts: () => ({ refreshCount, replayCount }) };
}

let checks = 0;
for (const replayStatus of [403, 409, 429, 500]) {
  const app = harness({ replayStatus });
  await assert.rejects(app.client.post('/messages', { text: 'Test' }), (error) => error.response?.status === replayStatus);
  assert.equal(app.tokens.getAccessToken(), 'renewed-token', `Replay ${replayStatus} must not clear a renewed session`);
  assert.equal(app.tokens.hasSessionHint(), true);
  assert.equal(app.browser.location.href, '/app');
  assert.deepEqual(app.counts(), { refreshCount: 1, replayCount: 1 });
  checks += 1;
}

{
  const app = harness({ replayNetworkError: true });
  await assert.rejects(app.client.get('/conversations'), { code: 'ERR_NETWORK' });
  assert.equal(app.tokens.getAccessToken(), 'renewed-token');
  assert.equal(app.browser.location.href, '/app');
  checks += 1;
}

for (const refreshStatus of [0, 429, 503]) {
  const app = harness({ refreshStatus });
  await assert.rejects(app.client.get('/conversations'));
  assert.equal(app.tokens.getAccessToken(), 'expired-token', `Transient refresh ${refreshStatus} must preserve retry context`);
  assert.equal(app.tokens.hasSessionHint(), true);
  assert.equal(app.browser.location.href, '/app');
  assert.deepEqual(app.counts(), { refreshCount: 1, replayCount: 0 });
  checks += 1;
}

for (const scenario of [{ refreshStatus: 401 }, { refreshStatus: 403 }, { replayStatus: 401 }]) {
  const app = harness(scenario);
  await assert.rejects(app.client.get('/conversations'));
  assert.equal(app.tokens.getAccessToken(), undefined);
  assert.equal(app.tokens.hasSessionHint(), false);
  assert.equal(app.browser.location.href, '/login');
  assert.equal(app.counts().refreshCount, 1, 'A failed replay must never cause an infinite refresh loop');
  checks += 1;
}

{
  const app = harness({});
  await Promise.all([app.client.get('/conversations'), app.client.get('/notifications')]);
  assert.deepEqual(app.counts(), { refreshCount: 1, replayCount: 2 });
  assert.equal(app.tokens.getAccessToken(), 'renewed-token');
  assert.equal(app.browser.location.href, '/app');
  checks += 1;
}

{
  const app = harness({});
  await Promise.all([app.authApi.refreshAccessToken(), app.client.get('/conversations')]);
  assert.deepEqual(app.counts(), { refreshCount: 1, replayCount: 1 }, 'Init API and interceptor must share one refresh');
  checks += 1;
}

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
for (const refreshStatus of [200, 401, 503]) {
  const started = deferred();
  const release = deferred();
  const app = harness({ refreshStatus, refreshWait: release.promise, onRefresh: started.resolve });
  const rejected = assert.rejects(app.client.get('/conversations'), { name: 'SessionChangedError' });
  await started.promise;
  app.tokens.clearAccessToken();
  app.tokens.setAccessToken('new-account-token');
  release.resolve();
  await rejected;
  assert.equal(app.tokens.getAccessToken(), 'new-account-token', 'Old refresh must not restore or clear a different account');
  assert.equal(app.browser.location.href, '/app');
  assert.equal(app.counts().replayCount, 0, 'A request from the old account must not replay as the new account');
  checks += 1;
}

for (const replayStatus of [200, 401, 403]) {
  const started = deferred();
  const release = deferred();
  const app = harness({ replayStatus, operationWait: release.promise, onOperation: started.resolve });
  app.tokens.setAccessToken('old-account-token');
  const rejected = assert.rejects(app.client.get('/conversations'), { name: 'SessionChangedError' });
  await started.promise;
  app.tokens.clearAccessToken();
  app.tokens.setAccessToken('new-account-token');
  release.resolve();
  await rejected;
  assert.equal(app.tokens.getAccessToken(), 'new-account-token');
  assert.equal(app.browser.location.href, '/app');
  assert.equal(app.counts().refreshCount, 0);
  checks += 1;
}

console.log(JSON.stringify({ passed: checks, boundary: 'Production interceptor + Axios test transport; live cookie/realtime verification is separate' }, null, 2));
