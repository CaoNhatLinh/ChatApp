import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as React from 'react';

const source = ts.transpileModule(readFileSync(new URL('../src/features/settings/model/system-settings-exit.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
vm.runInNewContext(`(function(exports,require){${source}})`)(exports, name => {
  if (name === 'react') return React;
  throw new Error(`Unexpected module: ${name}`);
});
for (const [states, expected] of [
  [[], 'clear'], [['clear', 'clear'], 'clear'], [['clear', 'draft'], 'draft'],
  [['draft', 'uncertain'], 'uncertain'], [['uncertain', 'busy'], 'busy'],
  [['busy', 'draft', 'uncertain'], 'busy'],
]) {
  assert.equal(exports.combineSettingsExitStates(states.values()), expected);
  assert.equal(exports.combineSettingsExitStates([...states].reverse()), expected, 'priority cannot depend on editor order');
}
console.log(JSON.stringify({ passed: 6, boundary: 'Actual exit state aggregation; no router interception or persistence claim' }));
