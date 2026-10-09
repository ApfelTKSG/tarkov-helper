import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProfile,
  createDatabase,
  parseDatabase,
  resetProfileProgress,
} from '../src/domain/profiles.ts';
import { setTaskAvailability } from '../src/domain/task-availability.ts';
import { evaluateAvailability } from '../src/domain/progression.ts';
import { canToggleTaskCompletion } from '../src/domain/task-presentation.ts';
import { toggleTaskCompletion } from '../src/domain/task-reputation.ts';

const task = {
  id: 'task',
  minPlayerLevel: 30,
  taskRequirements: [],
  traderRequirements: [],
  otherRequirements: [{ id: 'opaque', type: 'globalVariable' }],
  finishRewards: { traderStanding: [{ trader: 'trader', standing: 0.1 }] },
};

test('translucent tasks cannot quick-complete, while accepted and terminal records can', () => {
  for (const gate of ['unknown', 'blocked']) {
    assert.equal(canToggleTaskCompletion('unstarted', gate), false);
    for (const state of ['active', 'complete', 'failed'])
      assert.equal(canToggleTaskCompletion(state, gate), true);
  }
  assert.equal(canToggleTaskCompletion('unstarted', 'eligible'), true);
});

test('manual unlock bypasses gates without completion rewards; automatic follows current conditions', () => {
  const original = createProfile('regular', null);
  original.level = 1;
  original.traders.trader = { reputation: 0.2 };
  let profile = setTaskAvailability(original, task, 'available');
  const unlocked = evaluateAvailability(task, profile);
  assert.equal(unlocked.state, 'eligible');
  assert.ok(unlocked.conditions.some((condition) => condition.state === 'unmet'));
  assert.ok(unlocked.conditions.some((condition) => condition.state === 'unknown'));
  assert.equal(profile.tasks.task, 'active');
  assert.equal(profile.traders.trader.reputation, 0.2);
  assert.equal(profile.completedAt?.task, undefined);
  profile = toggleTaskCompletion(profile, task);
  assert.equal(profile.traders.trader.reputation, 0.3);
  profile = setTaskAvailability(profile, task, 'automatic');
  assert.equal(evaluateAvailability(task, profile).state, 'blocked');
  assert.equal(profile.tasks.task, 'unstarted');
  assert.equal(profile.traders.trader.reputation, 0.2);
  assert.equal(profile.taskAvailabilityOverrides.task, undefined);
  profile.level = 30;
  profile.confirmedRequirements = { 'task:opaque': true };
  assert.equal(evaluateAvailability(task, profile).state, 'eligible');
  profile = setTaskAvailability(profile, task, 'automatic');
  assert.equal(evaluateAvailability(task, profile).state, 'eligible');
  assert.equal(canToggleTaskCompletion(profile.tasks.task, 'eligible'), true);
  delete profile.confirmedRequirements['task:opaque'];
  assert.equal(evaluateAvailability(task, profile).state, 'unknown');
  assert.equal(canToggleTaskCompletion(profile.tasks.task, 'unknown'), false);
  // Old force-lock backups remain readable, but now follow automatic gates.
  profile.taskAvailabilityOverrides.task = 'unavailable';
  profile.confirmedRequirements['task:opaque'] = true;
  assert.equal(evaluateAvailability(task, profile).state, 'eligible');
  profile = setTaskAvailability(profile, task, 'available');
  const db = createDatabase();
  db.profiles.regular = profile;
  assert.equal(
    parseDatabase(JSON.stringify(db)).profiles.regular.taskAvailabilityOverrides.task,
    'available',
  );
  assert.equal(resetProfileProgress(profile).taskAvailabilityOverrides, undefined);
  db.profiles.regular.taskAvailabilityOverrides.task = 'invalid';
  assert.throws(() => parseDatabase(JSON.stringify(db)));
});
