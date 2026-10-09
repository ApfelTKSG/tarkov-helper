import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDatabase,
  migrateLegacy,
  parseDatabase,
  selectMode,
  resolveLegacyCounts,
} from '../src/domain/profiles.ts';
import { normalizeMode } from '../src/data/normalize.mjs';
import { makeFeeds } from './fixtures.mjs';

test('legacy migration preserves originals, unknown IDs and malformed-data warnings', () => {
  const values = {
    'tarkov-completed-tasks': '["taskA","removed-task"]',
    'tarkov-user-level': '42',
    'tarkov-fir-collected': '[["taskA-itemA",2],["removed-item",4]]',
    'tarkov-ignored-tasks': 'broken',
  };
  const original = JSON.stringify(values);
  const { database, warnings } = migrateLegacy({ getItem: (key) => values[key] ?? null });
  assert.equal(database.profiles.regular.tasks['removed-task'], 'complete');
  assert.equal(database.profiles.regular.level, 42);
  assert.equal(database.profiles.regular.legacyCollected['removed-item'], 4);
  assert.equal(database.migratedLegacy, true);
  assert.equal(warnings.length, 1);
  assert.equal(JSON.stringify(values), original);
  assert.deepEqual(parseDatabase(JSON.stringify(database)), database);
});

test('modes and seasons do not reuse or reset another profile', () => {
  let database = createDatabase();
  database.profiles.regular.tasks.taskA = 'complete';
  database = selectMode(database, 'pve', null);
  assert.deepEqual(database.profiles.pve.tasks, {});
  database = selectMode(database, 'pvp-season', 'season-1');
  database.profiles[database.selectedId].tasks.taskB = 'active';
  database = selectMode(database, 'pvp-season', 'season-2');
  assert.deepEqual(database.profiles[database.selectedId].tasks, {});
  assert.equal(database.profiles['pvp-season:season-1'].tasks.taskB, 'active');
  assert.equal(database.profiles.regular.tasks.taskA, 'complete');
});

test('restore rejects invalid states, negative allocations, unknown schema and unsafe keys', () => {
  const mutate = (fn) => {
    const database = createDatabase();
    fn(database);
    return JSON.stringify(database);
  };
  assert.throws(() => parseDatabase(mutate((d) => (d.schemaVersion = 2))));
  assert.throws(() => parseDatabase(mutate((d) => (d.profiles.regular.tasks.a = 'completed'))));
  assert.throws(() => parseDatabase(mutate((d) => (d.profiles.regular.objectiveCounts.a = -1))));
  assert.throws(() => parseDatabase(mutate((d) => (d.profiles.regular.traders.a = { level: 5 }))));
  assert.throws(() =>
    parseDatabase(
      mutate((d) => (d.profiles.regular.tasks = JSON.parse('{"__proto__":"complete"}'))),
    ),
  );
  assert.throws(() => parseDatabase(mutate((d) => (d.selectedId = 'missing'))));
});

test('alternative legacy allocations are migrated once per objective; ambiguity is retained', () => {
  const snapshot = normalizeMode('regular', makeFeeds());
  const profile = createDatabase().profiles.regular;
  profile.legacyCollected = { 'taskA-itemA': 2, 'taskA-itemB': 2, unknown: 9 };
  const migrated = resolveLegacyCounts(profile, snapshot);
  assert.equal(migrated.objectiveCounts['taskA:objectiveA'], 3);
  assert.deepEqual(migrated.legacyCollected, { unknown: 9 });
  assert.deepEqual(resolveLegacyCounts(migrated, snapshot), migrated);
  snapshot.tasks[0].objectives.push({
    id: 'another',
    type: 'giveItem',
    foundInRaid: true,
    items: ['itemA'],
    count: 1,
  });
  const ambiguous = resolveLegacyCounts(profile, snapshot);
  assert.equal(ambiguous.legacyCollected['taskA-itemA'], 2);
});

test('legacy hideout completion migrates even with no collected item records', () => {
  const snapshot = normalizeMode('regular', makeFeeds());
  snapshot.stations[0].normalizedName = 'station';
  const profile = createDatabase().profiles.regular;
  profile.tasks['hideout-station-1'] = 'complete';
  assert.equal(resolveLegacyCounts(profile, snapshot).stationLevels.stationA, 1);
});
