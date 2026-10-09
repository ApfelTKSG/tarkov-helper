import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signedOverlay } from './overlay-fixture.mjs';
import {
  fetchProgressionOverlay,
  supplementProgression,
  verifyOverlay,
} from '../src/data/progression-overlay.mjs';
import { normalizeMode } from '../src/data/normalize.mjs';
import { makeFeeds } from './fixtures.mjs';
import { evaluateAvailability } from '../src/domain/progression.ts';
import { taskLoyaltyColumn } from '../src/domain/task-columns.ts';
import { updateGameData } from '../scripts/update-game-data.mjs';

const entry = () => ({
  revision: '1.1.0',
  verification: 'verified',
  coverage: 'complete',
  derivation: { type: 'distinctTaskCompletions', taskIds: ['taskA', 'taskB'] },
  proof: ['https://example.com/proof'],
});
function overlay(counter = entry()) {
  return signedOverlay({
    tasks: {
      taskB: {
        traderRequirements: [
          { trader: { id: 'traderA' }, requirementType: 'level', compareMethod: '>=', value: 1 },
        ],
      },
    },
    progressionCounters: { regular: { opaque: counter }, pve: {}, 'pvp-season': {} },
  });
}
test('digest detects corruption and conditional overlay requests reuse the validated cached body', async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), 'overlay-'));
  const body = overlay();
  await fetchProgressionOverlay({
    cacheDirectory,
    fetcher: async () => new Response(JSON.stringify(body), { headers: { etag: 'v1' } }),
  });
  const cached = await fetchProgressionOverlay({
    cacheDirectory,
    fetcher: async (_, options) => {
      assert.equal(options.headers['If-None-Match'], 'v1');
      return { status: 304 };
    },
  });
  assert.deepEqual(cached, body);
  body.tasks.taskB.traderRequirements[0].value = 4;
  assert.throws(() => verifyOverlay(body), /digest/);
});
test('supplement imports mode counters and tier classification without replacing original gates', () => {
  const base = normalizeMode('regular', makeFeeds());
  const next = supplementProgression(base, overlay());
  assert.equal(next.tasks[1].supplementLoyaltyLevel, 1);
  assert.deepEqual(next.tasks[1].traderRequirements, base.tasks[1].traderRequirements);
  assert.equal(taskLoyaltyColumn(next.tasks[1]), 2); // explicit API condition wins
  assert.notEqual(next.revision, base.revision);
  assert.deepEqual(
    supplementProgression(normalizeMode('pve', makeFeeds()), overlay()).progressionCounters,
    {},
  );
  const removed = entry();
  removed.derivation.taskIds.push('removed');
  assert.equal(
    supplementProgression(base, overlay(removed)).progressionCounters.opaque.verification,
    'unresolved',
  );
  const duplicate = entry();
  duplicate.derivation.taskIds.push('taskA');
  assert.throws(() => supplementProgression(base, overlay(duplicate)), /Invalid progression/);
});
test('verified counts cross a threshold, undo and failure lower it, manual override remains available', () => {
  const snapshot = supplementProgression(normalizeMode('regular', makeFeeds()), overlay());
  const task = {
    ...snapshot.tasks[1],
    taskRequirements: [],
    traderRequirements: [],
    otherRequirements: [{ ...snapshot.tasks[1].otherRequirements[0], value: 2 }],
  };
  const profile = {
    tasks: { taskA: 'complete', taskB: 'active' },
    traders: {},
    progressionCounters: snapshot.progressionCounters,
    progressionRuleRevision: '1.1.0',
  };
  let result = evaluateAvailability(task, profile);
  assert.equal(result.state, 'blocked');
  assert.equal(result.conditions[0].counter.completed, 1);
  profile.tasks.taskB = 'complete';
  assert.equal(evaluateAvailability(task, profile).state, 'eligible');
  profile.tasks.taskB = 'failed';
  assert.equal(evaluateAvailability(task, profile).state, 'blocked');
  profile.confirmedRequirements = { 'taskB:global': true };
  assert.equal(evaluateAvailability(task, profile).state, 'eligible');
  delete profile.confirmedRequirements;
  profile.progressionCounters.opaque.verification = 'unresolved';
  assert.equal(evaluateAvailability(task, profile).state, 'unknown');
  profile.progressionCounters.opaque.verification = 'verified';
  profile.progressionRuleRevision = 'other';
  assert.equal(evaluateAvailability(task, profile).state, 'unknown');
});
test('overlay failure cannot publish a new manifest', async () => {
  const root = await mkdtemp(join(tmpdir(), 'overlay-publish-'));
  await assert.rejects(
    updateGameData({ root, overlayFetcher: async () => new Response('{}') }),
    /overlay update failed/,
  );
  await assert.rejects(readFile(join(root, 'public/game-data/manifest.json')));
});
