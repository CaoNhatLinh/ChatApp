import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const zero = '00000000-0000-0000-0000-000000000000';
const commandId = '00000000-0000-0000-0000-000000000001';
const actor = '00000000-0000-0000-0000-000000000002';
const boolean = { key: 'community.creationEnabled', type: 'BOOLEAN', value: true, defaultValue: true, min: null, max: null, revision: zero, updatedBy: null, updatedAt: null };
const integer = { key: 'community.defaultMaxMembers', type: 'INTEGER', value: 10000, defaultValue: 10000, min: 2, max: 100000, revision: zero, updatedBy: null, updatedAt: null };
const stored = { ...boolean, value: false, revision: commandId, updatedBy: actor, updatedAt: '2026-10-23T09:00:00Z' };
let response = [boolean, integer];
const requests = [];
let failure;
const client = { get: async (...args) => { requests.push(['GET', ...args]); return { data: response }; },
  put: async (...args) => { requests.push(['PUT', ...args]); if (failure) throw failure; return { data: response }; } };
const exports = {};
const source = ts.transpileModule(readFileSync(new URL('../src/features/settings/api/system-settings.api.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
vm.runInNewContext(`(function(exports,require){${source}})`, { Date })(exports, name => {
  if (name === '@/shared/api/apiClient') return { __esModule: true, default: client };
  throw new Error(`Unexpected module: ${name}`);
});
const controller = new AbortController();
assert.equal((await exports.listSystemSettings(controller.signal)).length, 2);
assert.equal(requests[0][2].signal, controller.signal);
for (const bad of [[], [boolean], [boolean, boolean], [boolean, { ...integer, key: 'secret' }],
  [{ ...boolean, value: 'true' }, integer], [boolean, { ...integer, value: 2.5 }],
  [{ ...boolean, revision: null }, integer], [{ ...stored, updatedBy: null }, integer],
  [{ ...boolean, value: false }, integer], [boolean, { ...integer, value: 250 }],
  [{ ...boolean, updatedAt: '2026-10-23T09:00:00Z' }, integer], [boolean, { ...integer, max: 999999 }]]) {
  response = bad;
  await assert.rejects(exports.listSystemSettings(), /system setting/i);
}
const command = { commandId, expectedRevision: zero, value: false, reason: 'Pause new communities' };
response = { commandId, setting: stored, auditPending: true };
assert.equal((await exports.saveSystemSetting(boolean.key, command, controller.signal)).auditPending, true);
assert.equal(requests.at(-1)[1], '/admin/system-settings/community.creationEnabled');
assert.equal(requests.at(-1)[2], command, 'frozen command is forwarded, not rebuilt');
for (const bad of [{ ...response, commandId: actor }, { ...response, auditPending: 'false' },
  { ...response, setting: integer }, { ...response, setting: boolean }]) {
  response = bad;
  await assert.rejects(exports.saveSystemSetting(boolean.key, command), /system setting/i);
}
response = { commandId, setting: { ...stored, revision: actor, value: true }, auditPending: false };
assert.equal((await exports.saveSystemSetting(boolean.key, command)).setting.revision, actor, 'exact replay can return newer current authority');
const count = requests.length;
await assert.rejects(exports.saveSystemSetting(boolean.key, { ...command, value: 'false' }), /system setting/i);
assert.equal(requests.length, count, 'invalid values never reach transport');
failure = new Error('Controlled 409');
await assert.rejects(exports.saveSystemSetting(boolean.key, command), /409/);
assert.equal(requests.length, count + 1, 'conflict is not silently retried or replayed');
console.log(JSON.stringify({ passed: 7, boundary: 'Actual typed settings adapter, controlled transport; not live backend' }));
