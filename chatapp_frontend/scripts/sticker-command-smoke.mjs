import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/stickers/model/stickerCommandAttempt.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(`(function(exports) { ${code} })`, { crypto: webcrypto })(exports);

const attempt = new exports.StickerCommandAttempt();
const draft = { name: 'Letters', reason: 'Publish approved artwork', expectedRevision: 'revision-a' };
const first = attempt.prepare('/pack/a', draft);
assert.equal(attempt.prepare('/pack/a', { ...draft }).commandId, first.commandId, 'uncertain retry reuses command ID');
assert.notEqual(attempt.prepare('/pack/b', draft).commandId, first.commandId, 'commands are target-bound');
const changed = attempt.prepare('/pack/b', { ...draft, name: 'Changed' });
assert.notEqual(changed.commandId, first.commandId, 'changed payload receives a new ID');
attempt.complete(first.commandId);
assert.equal(attempt.prepare('/pack/b', { ...draft, name: 'Changed' }).commandId, changed.commandId, 'late completion cannot clear another attempt');
attempt.complete(changed.commandId);
assert.notEqual(attempt.prepare('/pack/b', { ...draft, name: 'Changed' }).commandId, changed.commandId, 'confirmed completion ends replay');
assert.equal(draft.commandId, undefined, 'preparing must not mutate the form draft');
assert.notEqual(attempt.prepare('/pack/a', { ...draft, expectedRevision: 'revision-b' }).commandId, first.commandId, 'refreshing revision changes command');
console.log(JSON.stringify({ passed: 7, boundary: 'Production command attempt, no provider or database calls' }));
