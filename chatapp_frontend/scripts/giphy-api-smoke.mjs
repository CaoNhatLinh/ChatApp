import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../src/features/gifs/api/giphy.api.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const requests = [];
let status = 200;
let response;
let networkFailure;
let jsonFailure;
const exports = {};
vm.runInNewContext(`(function(exports) { ${code} })`, {
  URL,
  fetch: async (url, options) => {
    requests.push({ url: new URL(url), options });
    options.signal?.throwIfAborted();
    if (networkFailure) throw networkFailure;
    return { ok: status === 200, status, json: async () => { if (jsonFailure) throw jsonFailure; return response; } };
  },
})(exports);
const rendition = { url: 'https://media2.giphy.com/media/abc/200.gif?cid=keep%2Fthis&ep=v1', width: '200', height: '100' };
const gif = id => ({ id, type: 'gif', title: `GIF ${id}`, images: { fixed_width: rendition, fixed_width_still: { ...rendition, url: 'https://media2.giphy.com/media/abc/200_s.gif?ep=v1' } } });
const page = (data, offset = 0, total = 100) => ({ data, pagination: { offset, count: data.length, total_count: total }, meta: { status: 200 } });
const client = exports.createGiphyClient('fixture-web-key');
response = page([gif('z'), gif('a')]);
const signal = new AbortController().signal;
let result = await client.list({ query: 'xin chào & @cat', locale: 'vi', signal });
assert.equal(requests.at(-1).url.origin, 'https://api.giphy.com');
assert.equal(requests.at(-1).url.pathname, '/v1/gifs/search');
assert.equal(requests.at(-1).url.searchParams.get('q'), 'xin chào & @cat');
assert.equal(requests.at(-1).url.searchParams.get('rating'), 'g');
assert.equal(requests.at(-1).url.searchParams.get('limit'), '24');
assert.equal(requests.at(-1).options.credentials, 'omit');
assert.equal(requests.at(-1).options.cache, 'no-store');
assert.equal(requests.at(-1).options.signal, signal);
assert.equal(JSON.stringify(result.content.map(item => item.id)), '["z","a"]');
assert.equal(result.content[0].preview.url, rendition.url, 'provider media URL remains byte-for-byte unchanged');
assert.equal(result.content[0].preview.width, 200);
assert.equal(result.nextOffset, 2);

response = page([], 0, 0);
result = await client.list({ query: '' });
assert.equal(requests.at(-1).url.pathname, '/v1/gifs/trending');
assert.equal(result.nextOffset, null);
response = page([gif('last')], 499, 10000);
assert.equal((await client.list({ offset: 499 })).nextOffset, null, 'trending provider offset cap terminates');
response = page([], 24, 100);
assert.equal((await client.list({ offset: 24 })).nextOffset, null, 'zero-count response cannot loop');

const beforeInvalid = requests.length;
for (const options of [{ offset: -1 }, { offset: 0.5 }, { offset: 500 }, { query: 'cat', offset: 5000 }, { query: 'x'.repeat(51) }]) {
  await assert.rejects(client.list(options), error => error.code === 'INVALID_INPUT');
}
assert.equal(requests.length, beforeInvalid);
await assert.rejects(exports.createGiphyClient('').list({}), error => error.code === 'UNCONFIGURED');
assert.equal(requests.length, beforeInvalid);
for (const httpStatus of [401, 403, 429, 503]) {
  status = httpStatus;
  await assert.rejects(client.list({}), error => error.code === ({ 401: 'UNCONFIGURED', 403: 'UNCONFIGURED', 429: 'RATE_LIMITED', 503: 'UNAVAILABLE' })[httpStatus]
    && !error.message.includes('fixture-web-key'));
}
status = 200;
for (const invalid of [
  { ...page([]), meta: { status: 429 } },
  page([gif('a')], 1),
  { ...page([gif('a')]), pagination: { offset: 0, count: 2, total_count: 100 } },
  page([gif('../unsafe')]),
  page([{ ...gif('a'), images: { fixed_width: { ...rendition, url: 'https://media.giphy.com.evil.test/image.gif' } } }]),
  page([{ ...gif('a'), images: { fixed_width: { ...rendition, url: 'https://user:pass@media.giphy.com/a.gif' } } }]),
  page([{ ...gif('a'), images: { fixed_width: { ...rendition, width: 'Infinity' } } }]),
]) {
  response = invalid;
  await assert.rejects(client.list({}));
}
response = { data: gif('abc'), meta: { status: 200 } };
assert.equal((await client.get('abc')).id, 'abc');
assert.equal(requests.at(-1).url.pathname, '/v1/gifs/abc');
response = { data: gif('wrong-id'), meta: { status: 200 } };
await assert.rejects(client.get('abc'), error => error.code === 'INVALID_RESPONSE');
status = 404;
assert.equal(await client.get('removed'), null, 'missing provider ID stays unavailable');
status = 200;
response = page([{ ...gif('a'), images: {} }]);
assert.equal((await client.list({})).content[0].preview, null, 'unavailable rendition does not drop/reorder provider items');
response = { data: [], meta: { status: 404 } };
assert.equal(await client.get('removed'), null, 'provider metadata tombstone is unavailable even with HTTP200');
networkFailure = new Error('network failure including fixture-web-key');
await assert.rejects(client.list({}), error => error.code === 'UNAVAILABLE' && !error.message.includes('fixture-web-key'));
networkFailure = undefined;
jsonFailure = new SyntaxError('invalid JSON');
await assert.rejects(client.list({}), error => error.code === 'INVALID_RESPONSE');
jsonFailure = undefined;
const aborted = new AbortController(); aborted.abort();
await assert.rejects(client.list({ signal: aborted.signal }), error => error.name === 'AbortError');
console.log(JSON.stringify({ passed: 23, boundary: 'Production GIPHY client with controlled fetch; no provider request/key/cache' }));
