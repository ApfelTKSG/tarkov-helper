import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDatabase,
  createProfile,
  parseDatabase,
  resetProfileProgress,
} from '../src/domain/profiles.ts';
import { changeTaskState } from '../src/domain/task-reputation.ts';

test('self wipe clears all current progress while preserving prestige, identity, settings and other profiles', () => {
  const db = createDatabase();
  db.profiles.pve = createProfile('pve', null);
  const original = {
    ...db.profiles.regular,
    name: 'My character',
    level: 52,
    prestige: 5,
    faction: 'BEAR',
    taskFilter: 'favorites',
    tasks: { task: 'complete' },
    objectiveCounts: { item: 8 },
    legacyCollected: { old: 2 },
    traders: { trader: { reputation: 0.7, level: 4 } },
    taskReputation: { task: { trader: 0.1 } },
    taskStateBeforeCompletion: { task: 'active' },
    completedAt: { task: 123 },
    delayStartedAt: { task: 111 },
    confirmedAvailable: { task: true },
    confirmedRequirements: { gate: true },
    stationLevels: { station: 3 },
    skills: { strength: 50 },
    favorites: ['task'],
    hiddenTasks: ['hidden'],
    pinnedRevision: 'a'.repeat(64),
    dataRevision: 'a'.repeat(64),
  };
  db.profiles.regular = original;
  const reset = resetProfileProgress(original);
  for (const field of [
    'tasks',
    'traders',
    'objectiveCounts',
    'legacyCollected',
    'stationLevels',
    'skills',
  ])
    assert.deepEqual(reset[field], {});
  for (const field of [
    'completedAt',
    'delayStartedAt',
    'confirmedAvailable',
    'confirmedRequirements',
    'taskReputation',
    'taskStateBeforeCompletion',
  ])
    assert.equal(reset[field], undefined);
  assert.deepEqual(reset.favorites, []);
  assert.deepEqual(reset.hiddenTasks, []);
  assert.equal(reset.level, 1);
  for (const field of [
    'id',
    'name',
    'mode',
    'seasonId',
    'prestige',
    'faction',
    'taskFilter',
    'pinnedRevision',
    'dataRevision',
  ])
    assert.equal(reset[field], original[field]);
  db.profiles.regular = reset;
  assert.equal(db.profiles.pve.level, undefined);
  assert.equal(original.objectiveCounts.item, 8);
  const parsed = parseDatabase(JSON.stringify(db));
  assert.equal(parsed.profiles.regular.taskFilter, 'favorites');
  parsed.profiles.regular.taskFilter = 'eligible';
  assert.throws(() => parseDatabase(JSON.stringify(parsed)));
});

test('completion removes only that favorite and undo does not reinstate it', () => {
  const profile = createProfile('regular', null);
  profile.favorites = ['task', 'other'];
  const task = { id: 'task', finishRewards: { traderStanding: [] } };
  const completed = changeTaskState(profile, task, 'complete');
  assert.deepEqual(completed.favorites, ['other']);
  assert.deepEqual(changeTaskState(completed, task, 'active').favorites, ['other']);
  assert.deepEqual(profile.favorites, ['task', 'other']);
  const legacy = { ...profile, tasks: { task: 'complete' } };
  assert.deepEqual(changeTaskState(legacy, task, 'complete').favorites, ['other']);
  assert.deepEqual(changeTaskState(legacy, task, 'active').favorites, ['other']);
});
