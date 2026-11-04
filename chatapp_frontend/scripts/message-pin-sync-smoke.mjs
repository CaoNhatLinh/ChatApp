import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { chromium } from 'playwright';

// Mount the actual hook with React; only transport/store/reconnect boundaries
// are controlled. No backend or provider is contacted by this isolated page.
const require = createRequire(import.meta.url);
const modules = {};
for (const [name, packageName, file] of [
  ['react', 'react', 'react.production.js'],
  ['react-dom', 'react-dom', 'react-dom.production.js'],
  ['react-dom/client', 'react-dom', 'react-dom-client.production.js'],
  ['scheduler', 'scheduler', 'scheduler.production.js'],
]) modules[name] = readFileSync(join(dirname(require.resolve(`${packageName}/package.json`)), 'cjs', file), 'utf8');
modules.hook = ts.transpileModule(readFileSync(new URL('../src/features/messenger/model/useMessagePinSync.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
modules['@/features/messenger/api/messenger.api'] = 'exports.getMessagePinState = (...args) => window.pinHarness.lookup(...args);';
modules['./messenger.store'] = 'exports.useMessengerStore = { getState: () => ({ applyMessagePinState: state => window.pinHarness.applied.push(state) }) };';
modules['@/shared/websocket/websocketService'] = `exports.addConnectionListener = callback => {
  window.pinHarness.listeners.add(callback); callback();
  return () => window.pinHarness.listeners.delete(callback);
};`;
modules['@/shared/lib/logger'] = 'exports.logger = { debug() {} };';
const bundle = `(() => {
    const sources = ${JSON.stringify(modules)}, cache = {};
    function require(name) {
      if (cache[name]) return cache[name].exports;
      if (!Object.hasOwn(sources, name)) throw new Error('Uncontrolled dependency: ' + name);
      const module = cache[name] = { exports: {} };
      new Function('module', 'exports', 'require', sources[name])(module, module.exports, require);
      return module.exports;
    }
    const React = require('react');
    const { createRoot } = require('react-dom/client');
    const { useMessagePinSync } = require('hook');
    const root = createRoot(document.getElementById('root'));
    const pending = [], applied = [], listeners = new Set();
    window.pinHarness = {
      pending, applied, listeners,
      lookup: (room, signal) => new Promise((resolve, reject) => pending.push({ room, signal, resolve, reject })),
      mount: room => root.render(React.createElement(Probe, { key: room, room })),
      clear: () => root.render(null),
      reconnect: () => listeners.forEach(callback => callback()),
      finish: index => pending[index].resolve({ conversationId: pending[index].room, revision: '9', pins: [] }),
      fail: index => pending[index].reject(new Error('Controlled lookup failure')),
    };
    function Probe({ room }) {
      const { status, retry } = useMessagePinSync(room);
      return React.createElement('button', { onClick: retry, disabled: status === 'loading' }, status);
    }
  })();`;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="root"></div>');
  await page.addScriptTag({ content: bundle });
  const button = page.getByRole('button');
  const mount = async room => {
    await page.evaluate(room => window.pinHarness.mount(room), room);
    await page.waitForFunction(room => window.pinHarness.pending.some(request => request.room === room), room);
  };
  const waitText = text => button.getByText(text, { exact: true }).waitFor();

  await mount('room-a');
  assert.equal(await page.evaluate(() => window.pinHarness.pending.length), 1, 'eager ready callback does not duplicate initial GET');
  await page.evaluate(() => window.pinHarness.fail(0));
  await waitText('error');
  await button.press('Enter');
  await waitText('loading');
  assert.equal(await button.isDisabled(), true);
  await page.evaluate(() => window.pinHarness.reconnect());
  assert.equal(await page.evaluate(() => window.pinHarness.pending.length), 2, 'reconnect coalesces with an in-flight retry');
  await page.evaluate(() => window.pinHarness.fail(1));
  await waitText('error');
  await button.press('Enter');
  await page.waitForFunction(() => window.pinHarness.pending.length === 3);
  await page.evaluate(() => window.pinHarness.finish(2));
  await waitText('ready');
  assert.equal(await page.evaluate(() => window.pinHarness.applied.length), 1);

  await page.evaluate(() => window.pinHarness.reconnect());
  await page.waitForFunction(() => window.pinHarness.pending.length === 4);
  await mount('room-b');
  assert.equal(await page.evaluate(() => window.pinHarness.pending[3].signal.aborted), true);
  assert.equal(await page.evaluate(() => window.pinHarness.listeners.size), 1, 'old room reconnect listener removed');
  await page.evaluate(() => window.pinHarness.finish(3));
  assert.equal(await page.evaluate(() => window.pinHarness.applied.length), 1, 'late old-room result cannot apply');
  await page.evaluate(() => window.pinHarness.finish(4));
  await waitText('ready');
  assert.deepEqual(await page.evaluate(() => window.pinHarness.applied.map(state => state.conversationId)), ['room-a', 'room-b']);

  await page.evaluate(() => window.pinHarness.reconnect());
  await page.waitForFunction(() => window.pinHarness.pending.length === 6);
  await page.evaluate(() => window.pinHarness.clear());
  await button.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.pinHarness.listeners.size), 0);
  assert.equal(await page.evaluate(() => window.pinHarness.pending[5].signal.aborted), true);
  await page.evaluate(() => window.pinHarness.fail(5));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: 4, boundary: 'Actual React hook lifecycle; controlled transport/store/reconnect, not live backend' }));
} finally {
  await browser.close();
}
