import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const source = await readFile(new URL('../src/features/calls/model/call-command-channel.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(`(function(exports) { ${code} })`, { setTimeout, clearTimeout, crypto: webcrypto })(exports);
const actor = '00000000-0000-0000-0000-000000000801', peer = '00000000-0000-0000-0000-000000000802';
const room = '00000000-0000-0000-0000-000000000803', callId = '00000000-0000-0000-0000-000000000804';
const body = { conversationId: room, callId, targetUserId: peer, callType: 'VOICE' };
const state = { conversationId: room, callId, callerId: actor, calleeId: peer, callType: 'VOICE', status: 'RINGING',
  createdAt: '2026-10-20T09:00:00Z', acceptedAt: null, endedAt: null, deadline: '2026-10-20T09:00:45Z', revision: webcrypto.randomUUID(), version: 1 };
let receive, connected = true, unsubscribed = false;
const sent = [];
const port = { isConnected: () => connected, subscribe: (destination, callback) => { assert.equal(destination, '/user/queue/call-results'); receive = callback; return () => { unsubscribed = true; }; }, publish: (...args) => sent.push(args) };
const channel = new exports.CallCommandChannel(port, actor, 100);
const pending = channel.send('START', body);
const [destination, command] = sent.at(-1);
assert.equal(destination, '/app/call.start'); assert.ok(command.requestId); assert.equal(command.callId, callId);
receive({ requestId: command.requestId, conversationId: room, callId, action: 'START', accepted: true, errorCode: null, state });
assert.equal((await pending).version, 1);
channel.close(); assert.equal(unsubscribed, true);
let passed = 1;
const harness = (timeout = 100) => {
  let receive, online = true; const commands = [];
  const port = { isConnected: () => online, subscribe: (_, callback) => { receive = callback; return () => {}; }, publish: (destination, command) => commands.push({ destination, command }) };
  const channel = new exports.CallCommandChannel(port, actor, timeout);
  const reply = (index = commands.length - 1, overrides = {}) => {
    const { command } = commands[index];
    receive({ requestId: command.requestId, conversationId: command.conversationId, callId: command.callId,
      action: commands[index].destination.split('.').at(-1).toUpperCase(), accepted: true, errorCode: null, state, ...overrides });
  };
  return { channel, commands, reply, port, offline: () => { online = false; } };
};
for (const [errorCode, uncertain] of [['FORBIDDEN', false], ['CONFLICT', false], ['UNAVAILABLE', true]]) {
  const h = harness(); const result = h.channel.send('START', body);
  h.reply(0, { accepted: false, errorCode, state: null });
  await assert.rejects(result, error => error.code === errorCode && error.uncertain === uncertain); h.channel.close(); passed++;
}
for (const corrupt of [
  { conversationId: webcrypto.randomUUID() }, { callId: webcrypto.randomUUID() }, { action: 'END' },
  { accepted: false, errorCode: 'provider stack trace', state: null },
  ...[{ ...state, version: 0 }, { ...state, callerId: webcrypto.randomUUID() }, { ...state, callType: 'VIDEO' },
    { ...state, createdAt: 'invalid' }, { ...state, status: 'ACCEPTED', acceptedAt: null },
    { ...state, status: 'MISSED', endedAt: null }].map(state => ({ state })),
]) {
  const h = harness(); const result = h.channel.send('START', body); h.reply(0, corrupt);
  await assert.rejects(result, error => error.code === 'INVALID_RESPONSE' && error.uncertain); h.channel.close(); passed++;
}
{
  const h = harness(); const a = h.channel.send('SYNC', body), b = h.channel.send('HEARTBEAT', body);
  assert.notEqual(h.commands[0].command.requestId, h.commands[1].command.requestId);
  h.reply(1); h.reply(0); await Promise.all([a, b]); h.channel.close(); passed++;
}
{
  const h = harness(5); const old = h.channel.send('START', body);
  await assert.rejects(old, error => error.code === 'UNCONFIRMED' && error.uncertain);
  const next = h.channel.send('START', body); let resolved = false; next.then(() => { resolved = true; });
  h.reply(0); await Promise.resolve(); assert.equal(resolved, false);
  assert.equal(h.commands[0].command.callId, h.commands[1].command.callId, 'channel never invents a replacement call');
  h.reply(1); await next; h.channel.close(); passed++;
}
{
  const h = harness(); const pending = h.channel.send('SYNC', body); h.channel.close();
  await assert.rejects(pending, error => error.code === 'CLOSED');
  await assert.rejects(h.channel.send('SYNC', body), error => error.code === 'CLOSED'); passed++;
}
{
  const h = harness(); h.offline(); await assert.rejects(h.channel.send('START', body), error => error.code === 'DISCONNECTED');
  assert.equal(h.commands.length, 0); h.channel.close(); passed++;
}
{
  const h = harness(); h.port.publish = () => { throw new Error('socket failed'); };
  await assert.rejects(h.channel.send('SIGNAL', body), error => error.code === 'UNCONFIRMED'); h.channel.close(); passed++;
}
{
  const h = harness(1000); const pending = Array.from({ length: 64 }, () => h.channel.send('SYNC', body).catch(error => error));
  await assert.rejects(h.channel.send('SYNC', body), error => error.code === 'BUSY');
  h.channel.close(); await Promise.all(pending); passed++;
}
console.log(JSON.stringify({ passed, boundary: 'Controlled correlated call channel, not live STOMP' }));
