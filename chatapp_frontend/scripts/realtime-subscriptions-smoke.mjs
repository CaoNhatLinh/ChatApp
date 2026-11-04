import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/shared/websocket/realtime-service.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
let client = { active: true, connected: false, subscribe: (...args) => {
  subscriptions.push(args);
  return { unsubscribe: () => { unsubscribed++; } };
} };
const listeners = new Set(), subscriptions = [];
let unsubscribed = 0, connections = 0;
const module = {};
vm.runInNewContext(`(function(exports, require) { ${code} })`)(module, name => {
  if (name === '@/shared/lib/logger') return { logger: { debug() {}, info() {}, warn() {}, error() {} } };
  if (name === '@/shared/websocket/websocketService') return {
    getStompClient: () => client,
    connectWebSocket: async () => {
      connections++;
      client.active = true; client.connected = true;
      for (const listener of listeners) listener();
    },
    addConnectionListener: callback => {
      listeners.add(callback);
      if (client.connected) callback();
      return () => listeners.delete(callback);
    },
  };
  throw new Error(`Unexpected dependency ${name}`);
});
const seen = [];
const stop = module.realtimeService.subscribe('/user/queue/call-results', value => seen.push(value));
assert.equal(subscriptions.length, 0);
client.connected = true;
for (const listener of listeners) listener();
assert.equal(subscriptions.length, 1, 'queued subscribers bind on the shared transport without requiring connect()');
subscriptions[0][1]({ body: '{"accepted":true}' });
assert.equal(seen[0].accepted, true);
const second = module.realtimeService.subscribe('/user/queue/call-results', () => {});
assert.equal(subscriptions.length, 1, 'callbacks share one transport subscription');
stop();
assert.equal(unsubscribed, 0, 'one callback cleanup does not remove another subscriber');
second();
assert.equal(unsubscribed, 1);
for (const listener of listeners) listener();
assert.equal(subscriptions.length, 1, 'removed callbacks do not reappear on reconnect');
assert.equal(connections, 0, 'subscribing never opens another transport');
client.active = false; client.connected = false;
const stopNext = module.realtimeService.subscribe('/user/queue/call-results', () => {});
await module.realtimeService.connect('controlled-token');
assert.equal(subscriptions.length, 2, 'explicit connect restores exactly once, not another duplicate after its promise resolves');
assert.equal(connections, 1);
await module.realtimeService.connect('controlled-token');
assert.equal(subscriptions.length, 2);
stopNext();
console.log(JSON.stringify({ passed: 11, boundary: 'Production realtime adapter; controlled shared transport, no broker' }));
