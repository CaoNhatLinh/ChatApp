import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile('src/features/admin/model/activity-summary.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { summarizeAdminActivity } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const points = [
  { eventDay: '2026-10-02', eventType: 'MESSAGE_SENT' },
  { eventDay: '2026-10-01', eventType: 'MESSAGE_SENT' },
  { eventDay: '2026-10-02', eventType: 'POLL_VOTED' },
];
const all = summarizeAdminActivity(points);
assert.deepEqual(all.days, [['2026-10-01', 1], ['2026-10-02', 2]]);
assert.deepEqual(all.types, [['MESSAGE_SENT', 2], ['POLL_VOTED', 1]]);
assert.equal(all.count, 3);
assert.deepEqual(summarizeAdminActivity(points, '2026-10-02').types, [['MESSAGE_SENT', 1], ['POLL_VOTED', 1]]);
assert.equal(summarizeAdminActivity(points, '2026-10-02').count, 2);
assert.equal(summarizeAdminActivity(points, 'missing').count, 0);
assert.deepEqual(summarizeAdminActivity([]), { days: [], types: [], count: 0 });
assert.equal(points.length, 3);
console.log('PASS: 8 loaded-event aggregation checks');
