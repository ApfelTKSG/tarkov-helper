import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySnapshot, canonicalJson, parseManifest } from '../src/domain/snapshot.ts';
import { normalizeMode, stableStringify } from '../src/data/normalize.mjs';
import { matchesTask, taskDepths, objectiveRemaining } from '../src/domain/task-view.ts';
import { createDatabase } from '../src/domain/profiles.ts';
import { makeFeeds } from './fixtures.mjs';

test('browser canonicalization matches updater and rejects corrupt or cross-mode snapshots', async () => {
  const snapshot = normalizeMode('regular', makeFeeds());
  assert.equal(canonicalJson(snapshot), stableStringify(snapshot));
  assert.equal(await verifySnapshot(snapshot, 'regular', snapshot.revision, null), snapshot);
  await assert.rejects(verifySnapshot(snapshot, 'pve', snapshot.revision, null));
  await assert.rejects(
    verifySnapshot({ ...snapshot, tasks: [] }, 'regular', snapshot.revision, null),
  );
  assert.throws(() =>
    parseManifest({
      schemaVersion: 1,
      modes: { regular: { revision: 'a'.repeat(64), file: '../secret' } },
    }),
  );
});

test('bilingual item search finds tasks; shared candidates use one remaining objective count', () => {
  const snapshot = normalizeMode('regular', makeFeeds());
  const task = snapshot.tasks[0];
  assert.equal(matchesTask(task, '品A', snapshot), true);
  assert.equal(matchesTask(task, 'ITEM B', snapshot), true);
  const profile = createDatabase().profiles.regular;
  profile.objectiveCounts['taskA:objectiveA'] = 2;
  assert.equal(objectiveRemaining(task, 'objectiveA', profile), 1);
  profile.tasks.taskA = 'failed';
  assert.equal(objectiveRemaining(task, 'objectiveA', profile), 0);
});

test('graph layout terminates for cycles and excludes external prerequisites', () => {
  const snapshot = normalizeMode('regular', makeFeeds());
  snapshot.tasks[0].taskRequirements = [
    { task: 'taskB', status: ['complete'] },
    { task: 'external', status: ['active'] },
  ];
  const depths = taskDepths(snapshot.tasks);
  assert.equal(depths.size, 2);
  assert.equal(
    [...depths.values()].every((depth) => Number.isFinite(depth) && depth <= 30),
    true,
  );
});

test('keys and consumable markers remain available in normalized item metadata', () => {
  const feeds = makeFeeds();
  feeds.tasks.body.data.tasks.taskA.neededKeys = [{ map: 'mapA', keys: ['unused'] }];
  assert.ok(normalizeMode('regular', feeds).items.unused);
  delete feeds.tasks.body.data.tasks.taskA.neededKeys;
  feeds.tasks.body.data.tasks.taskA.objectives[0].markerItem = 'unused';
  assert.ok(normalizeMode('regular', feeds).items.unused);
});
