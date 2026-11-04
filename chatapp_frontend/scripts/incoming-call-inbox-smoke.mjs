import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';
import * as zustand from 'zustand';
const evaluate = async (path, dependencies = {}) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(`(function(exports, require) { ${code} })`)(exports, name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected dependency ${name}`);
  });
  return exports;
};
const channel = await evaluate('../src/features/calls/model/call-command-channel.ts');
const model = await evaluate('../src/features/calls/model/incoming-call-inbox.ts', { './call-command-channel': channel });
const id = tail => `00000000-0000-0000-0000-${String(tail).padStart(12, '0')}`;
const actor = id(901), peer = id(902), room = id(903), call = id(904), revision = id(905);
const now = Date.parse('2026-10-20T08:00:00Z');
const snapshot = { conversationId: room, callId: call, callerId: peer, calleeId: actor, revision, version: 1,
  callType: 'VOICE', status: 'RINGING', createdAt: new Date(now).toISOString(), acceptedAt: null, endedAt: null,
  deadline: new Date(now + 45000).toISOString() };
const event = state => ({ action: 'STATE', conversationId: state.conversationId, callId: state.callId, occurredAt: new Date(now).toISOString(), state });
const receive = (items, state) => model.receiveIncomingCall(items, event(state), actor);
let items = receive([], snapshot);
assert.equal(model.nextIncomingCall(items, now)?.callId, call);
assert.equal(model.nextIncomingCall(items, now, room), undefined, 'active visible DM owns its own incoming panel');
assert.equal(model.nextIncomingCall(items, now + 45000), undefined, 'exact deadline removes a notice');
assert.equal(receive(items, snapshot), items, 'duplicate versions do not rerender or reopen');
items = model.hideIncomingCall(items, room, call);
assert.equal(model.nextIncomingCall(items, now), undefined, 'hide is local, not decline');
items = receive(items, { ...snapshot, version: 2, revision: id(906) });
assert.equal(model.nextIncomingCall(items, now), undefined, 'heartbeats cannot undo a local dismissal');
const ended = { ...snapshot, status: 'MISSED', version: 3, endedAt: new Date(now + 45000).toISOString() };
items = receive([], ended);
assert.equal(receive(items, snapshot), items, 'terminal tombstone rejects late ringing');
assert.equal(model.nextIncomingCall(receive(items, { ...snapshot, version: 4 }), now), undefined, 'terminal authority is not resurrected by an invalid higher ringing version');
const accepted = { ...snapshot, status: 'ACCEPTED', version: 2, acceptedAt: new Date(now + 1000).toISOString() };
items = receive(receive([], snapshot), accepted);
assert.equal(model.nextIncomingCall(items, now), undefined, 'accepting on another session removes the notice');
assert.equal(receive(items, { ...snapshot, version: 3 }), items, 'accepted cannot regress to ringing');
for (const invalid of [null, {}, { ...event(snapshot), action: 'SIGNAL' },
  { ...event(snapshot), conversationId: id(999) }, event({ ...snapshot, calleeId: peer, callerId: actor }),
  event({ ...snapshot, callerId: actor }), event({ ...snapshot, callId: 'bad' }),
  event({ ...snapshot, version: 0 }), event({ ...snapshot, revision: 'bad' }),
  event({ ...snapshot, endedAt: new Date(now).toISOString() }),
  { ...event(snapshot), occurredAt: 'invalid' }]) {
  assert.equal(model.receiveIncomingCall(items, invalid, actor), items, 'invalid/nonrecipient event is ignored');
}
items = [];
for (let i = 0; i < 200; i++) items = receive(items, { ...snapshot, callId: id(1000 + i), conversationId: id(2000 + i) });
assert.equal(items.length, 128, 'memory remains bounded without persistent private call history');
assert.equal(receive(items, { ...snapshot, callId: id(1199), conversationId: id(2199), callerId: id(777), version: 2 }), items, 'same call identity cannot switch participants');
const { useIncomingCallStore: store } = await evaluate('../src/features/calls/model/incoming-call.store.ts', {
  zustand, './incoming-call-inbox': model,
});
store.getState().setScope(actor, 1);
store.getState().receive(event(snapshot), actor, 1);
assert.equal(store.getState().items.length, 1);
store.getState().setScope(actor, 1);
assert.equal(store.getState().items.length, 1, 'route remount keeps the same session inbox');
store.getState().setScope(actor, 2);
assert.equal(store.getState().items.length, 0);
store.getState().receive(event(snapshot), actor, 1);
assert.equal(store.getState().items.length, 0, 'late previous-session subscription cannot repopulate state');
store.getState().receive(event(snapshot), actor, 2);
store.getState().resetState();
assert.equal(store.getState().actorId, null);
assert.equal(store.getState().items.length, 0);
store.getState().receive(event(snapshot), actor, 2);
assert.equal(store.getState().items.length, 0, 'logout rejects late frames before component cleanup');
store.getState().setScope(actor, 3);
store.getState().receiveSnapshot(snapshot, actor, 3);
assert.equal(store.getState().items.length, 1, 'HTTP snapshot shares the session inbox');
store.getState().receive(event(ended), actor, 3);
store.getState().receiveSnapshot(snapshot, actor, 3);
assert.equal(model.nextIncomingCall(store.getState().items, now), undefined, 'stale HTTP cannot undo terminal STATE');
store.getState().receiveSnapshot({ ...snapshot, version: 4 }, actor, 3);
assert.equal(model.nextIncomingCall(store.getState().items, now), undefined, 'HTTP cannot resurrect terminal even with invalid higher version');
store.getState().setScope(actor, 4);
store.getState().receiveSnapshot(snapshot, actor, 4);
store.getState().hide(room, call);
store.getState().receiveSnapshot({ ...snapshot, version: 2 }, actor, 4);
assert.equal(model.nextIncomingCall(store.getState().items, now), undefined, 'HTTP reconnect preserves local hide');
store.getState().receive(event({ ...accepted, version: 4 }), actor, 4);
store.getState().receiveSnapshot({ ...snapshot, version: 5 }, actor, 4);
assert.equal(store.getState().items[0].snapshot.status, 'ACCEPTED', 'HTTP ringing cannot regress accepted STATE');
store.getState().setScope(actor, 5);
store.getState().receiveSnapshot(snapshot, actor, 4);
assert.equal(store.getState().items.length, 0, 'old generation HTTP cannot repopulate private memory');
store.getState().receiveSnapshot({ ...snapshot, calleeId: peer }, actor, 5);
assert.equal(store.getState().items.length, 0, 'wrong recipient cannot enter current scope');
console.log(JSON.stringify({ passed: 38, boundary: 'Actual private STATE/validated HTTP inbox and store; controlled clock and canonical snapshots' }));
