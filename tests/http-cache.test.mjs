import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fetchEnvelope } from '../src/data/http-cache.mjs';

test('ETag conditional request reuses a cached body without reading a 304 body', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'tarkov-http-'));
  let calls = 0;
  const fetcher = async (_url, options) => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ data: { value: 1 } }), { headers: { etag: '"v1"' } });
    assert.equal(options.headers['If-None-Match'], '"v1"');
    return { status: 304, json() { throw new Error('304 body must never be read'); } };
  };
  const first = await fetchEnvelope('regular/tasks', { cacheDirectory, fetcher });
  const second = await fetchEnvelope('regular/tasks', { cacheDirectory, fetcher });
  assert.equal(first.notModified, false);
  assert.equal(second.notModified, true);
  assert.deepEqual(second.body, first.body);
});

test('Last-Modified is used when ETag is absent', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'tarkov-http-'));
  await fetchEnvelope('regular/tasks', { cacheDirectory, fetcher: async () => new Response('{"data":{"value":1}}', { headers: { 'last-modified': 'Tue, 06 Oct 2026 04:00:00 GMT' } }) });
  await fetchEnvelope('regular/tasks', { cacheDirectory, fetcher: async (_url, options) => {
    assert.equal(options.headers['If-Modified-Since'], 'Tue, 06 Oct 2026 04:00:00 GMT');
    return { status: 304 };
  } });
});

test('corrupt cache does not send validators, and an error leaves a good cache intact', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'tarkov-http-'));
  const file = join(cacheDirectory, 'regular--tasks.json');
  await writeFile(file, 'broken');
  await fetchEnvelope('regular/tasks', { cacheDirectory, fetcher: async (_url, options) => {
    assert.equal(options.headers['If-None-Match'], undefined);
    return new Response('{"data":{"good":true}}', { headers: { etag: 'good' } });
  } });
  const before = await readFile(file, 'utf8');
  await assert.rejects(fetchEnvelope('regular/tasks', { cacheDirectory, attempts: 1, fetcher: async () => new Response('{"errors":["unavailable"]}') }), /Invalid API envelope/);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('unsupported paths and HTTP 404 fail without retries', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'tarkov-http-'));
  await assert.rejects(fetchEnvelope('../secrets', { cacheDirectory }), /Unsupported API path/);
  let calls = 0;
  await assert.rejects(fetchEnvelope('regular/tasks', { cacheDirectory, sleep: async () => {}, fetcher: async () => { calls++; return new Response('', { status: 404 }); } }), /404/);
  assert.equal(calls, 1);
});
