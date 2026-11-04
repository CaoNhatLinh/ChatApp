import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/widgets/chat-window/model/chat-scroll-policy.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exported = {};
vm.runInNewContext(`(function(exports) { ${code} })`)(exported);
const { getChatScrollAction, isNearHistoryEnd } = exported;
const first = { conversationId: 'a', firstKey: '1', lastKey: '3' };
const decide = (previous, current, nearEnd = false, ownAppend = false) =>
  getChatScrollAction(previous, current, nearEnd, ownAppend);
assert.equal(decide(null, first), 'latest', 'initial history opens at latest');
assert.equal(decide(first, { ...first, conversationId: 'b' }), 'latest', 'room switch resets position');
assert.equal(decide(first, first), 'preserve', 'typing or editing does not move history');
assert.equal(decide(first, { ...first, lastKey: '4' }), 'notify', 'incoming while reading preserves position');
assert.equal(decide(first, { ...first, lastKey: '4' }, true), 'latest', 'following reader follows new content');
assert.equal(decide(first, { ...first, lastKey: '4' }, false, true), 'latest', 'own new send goes to latest');
assert.equal(decide(first, { ...first, firstKey: '0' }), 'anchor', 'loading older content preserves anchor');
assert.equal(decide({ ...first, lastKey: null }, first), 'latest', 'async initial load reaches latest');
assert.equal(isNearHistoryEnd(1000, 500, 450), true);
assert.equal(isNearHistoryEnd(1000, 500, 200), false);
console.log(JSON.stringify({ passed: 10, boundary: 'Production scroll policy; browser layout verified separately' }));
