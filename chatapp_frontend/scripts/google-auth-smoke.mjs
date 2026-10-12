import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const safePathSource = await readFile(
  new URL('../src/features/auth/lib/safe-return-path.ts', import.meta.url),
  'utf8',
);
const transpiled = ts.transpileModule(safePathSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const safePathModule = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);
const { safeReturnPath } = safePathModule;

assert.equal(safeReturnPath('/join/invite-123?source=google'), '/join/invite-123?source=google');
assert.equal(safeReturnPath('/friends#requests'), '/friends#requests');
for (const unsafePath of [
  null,
  'https://attacker.example',
  '//attacker.example',
  '/\\attacker.example',
  '/%5Cattacker.example',
  '/%252F%252Fattacker.example',
  '/login',
  '/register/',
  '/%6Cogin',
]) {
  assert.equal(safeReturnPath(unsafePath), '/friends', `unsafe return path accepted: ${unsafePath}`);
}

const googleApiSource = await readFile(
  new URL('../src/features/auth/api/google-auth.api.ts', import.meta.url),
  'utf8',
);
for (const endpoint of [
  '/auth/providers',
  '/auth/google/exchange',
  '/auth/google/register',
  '/auth/identities',
  '/auth/identities/google',
]) {
  assert.ok(googleApiSource.includes(endpoint), `missing Google auth endpoint: ${endpoint}`);
}

const openApiSource = await readFile(new URL('../../docs/api/openapi.yaml', import.meta.url), 'utf8');
for (const endpoint of [
  '/auth/providers:',
  '/auth/google/exchange:',
  '/auth/google/register:',
  '/auth/identities:',
  '/auth/identities/google:',
]) {
  assert.ok(openApiSource.includes(endpoint), `OpenAPI is missing: ${endpoint}`);
}

console.log(JSON.stringify({
  checkedSafeReturnCases: 11,
  checkedHttpContracts: 5,
  liveFirebaseRequired: true,
}, null, 2));
