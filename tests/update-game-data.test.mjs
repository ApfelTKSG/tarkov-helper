import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { updateGameData as update } from '../scripts/update-game-data.mjs';
import { signedOverlay } from './overlay-fixture.mjs';
const updateGameData = (options) =>
  update({ ...options, overlayFetcher: async () => new Response(JSON.stringify(signedOverlay())) });
import { makeFeeds } from './fixtures.mjs';

function server(feeds, version, failPath) {
  return async (url, options) => {
    const path = new URL(url).pathname.slice(1);
    if (path === failPath) return new Response('', { status: 404 });
    if (options.headers['If-None-Match'] === version) return { status: 304 };
    const data =
      path === 'endpoints'
        ? { data: { gameModes: ['regular', 'pve', 'pvp-season'] } }
        : path === 'pvp-season/season'
          ? { data: { id: 'seasonA' } }
          : feeds[path.split('/')[1]]?.body;
    assert.ok(data, `Unexpected path ${path}`);
    return new Response(JSON.stringify(data), { headers: { etag: version } });
  };
}

test('unchanged run does not rewrite manifest; changed run retains a previous snapshot', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tarkov-update-'));
  const feeds = makeFeeds();
  const first = await updateGameData({ root, modes: ['regular'], fetcher: server(feeds, 'v1') });
  assert.equal(first.changed, true);
  const file = join(root, 'public/game-data/manifest.json');
  const before = await readFile(file, 'utf8');
  const unchanged = await updateGameData({
    root,
    modes: ['regular'],
    fetcher: server(feeds, 'v1'),
  });
  assert.equal(unchanged.changed, false);
  assert.equal(unchanged.modes[0].notModified, 15);
  assert.equal(await readFile(file, 'utf8'), before);
  feeds.tasks.body.data.tasks.taskB.traderRequirements[0].value = 3;
  await updateGameData({ root, modes: ['regular'], fetcher: server(feeds, 'v2') });
  const next = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(next.modes.regular.previous.revision, first.modes[0].revision);
  assert.ok(
    await readFile(join(root, 'public/game-data', next.modes.regular.previous.file), 'utf8'),
  );
});

test('failure in a later mode never publishes an earlier mode candidate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tarkov-update-'));
  const feeds = makeFeeds();
  await updateGameData({ root, modes: ['regular', 'pve'], fetcher: server(feeds, 'v1') });
  const file = join(root, 'public/game-data/manifest.json');
  const before = await readFile(file, 'utf8');
  feeds.tasks.body.data.tasks.taskA.minPlayerLevel = 5;
  await assert.rejects(
    updateGameData({
      root,
      modes: ['regular', 'pve'],
      fetcher: server(feeds, 'v2', 'pve/tasks_ja'),
    }),
    /404/,
  );
  assert.equal(await readFile(file, 'utf8'), before);
});

test('corrupted previous snapshot is not silently accepted as a fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tarkov-update-'));
  const feeds = makeFeeds();
  await updateGameData({ root, modes: ['regular'], fetcher: server(feeds, 'v1') });
  const manifest = JSON.parse(await readFile(join(root, 'public/game-data/manifest.json'), 'utf8'));
  const snapshotPath = join(root, 'public/game-data', manifest.modes.regular.file);
  const data = JSON.parse(await readFile(snapshotPath, 'utf8'));
  data.tasks[0].minPlayerLevel = 99;
  await writeFile(snapshotPath, JSON.stringify(data));
  await assert.rejects(
    updateGameData({ root, modes: ['regular'], fetcher: server(feeds, 'v1') }),
    /integrity validation/,
  );
});
