import test from 'node:test';
import assert from 'node:assert/strict';
import { firTaskPriority, firItemPriority } from '../src/domain/fir-priority.ts';
import { compareLockRank } from '../src/domain/task-groups.ts';
import { evaluateAvailability } from '../src/domain/progression.ts';
import { createProfile } from '../src/domain/profiles.ts';

const collector = 'collector';
const task = (id, fields = {}) => ({
  id,
  name: id,
  englishName: id,
  trader: 'trader',
  objectives: [],
  taskRequirements: [],
  traderRequirements: [],
  ...fields,
});
const demand = (taskId, count = 1) => ({ taskId, taskName: taskId, objectiveId: 'item', count });
const context = (tasks) => {
  const profile = createProfile('regular', null);
  profile.level = 1;
  profile.traders.trader = { level: 1, reputation: 0 };
  const snapshot = { tasks, traders: [{ id: 'trader', levels: [] }] };
  const priorities = () =>
    new Map(
      tasks.map((t) => [
        t.id,
        firTaskPriority(t, profile, snapshot, evaluateAvailability(t, profile)),
      ]),
    );
  return { profile, snapshot, priorities };
};

test('FiR items prioritize task favorites, current needs, nearby unlocks, later needs, unknowns, Collector, then secured items', () => {
  const tasks = [
    task('now'),
    task('near', { minPlayerLevel: 5 }),
    task('later', { minPlayerLevel: 40 }),
    task('unknown', { otherRequirements: [{ type: 'dialogue' }] }),
    task(collector),
    task('starred-late', { minPlayerLevel: 60 }),
    task('secured'),
  ];
  const { profile, priorities } = context(tasks);
  profile.favorites = ['starred-late', 'secured'];
  const sorted = tasks
    .map((t) => ({
      id: t.id,
      ...firItemPriority([demand(t.id)], priorities(), profile, t.id === 'secured', collector),
    }))
    .sort((a, b) => compareLockRank(a.rank, b.rank));
  assert.deepEqual(
    sorted.map((t) => t.id),
    ['starred-late', 'now', 'near', 'later', 'unknown', collector, 'secured'],
  );
  assert.equal(sorted[0].favorite, true);
  profile.favorites = [];
  assert.equal(
    firItemPriority([demand('starred-late')], priorities(), profile, false, collector).favorite,
    false,
  );
});

test('shared items use the earliest outstanding demand, not an already secured early or favorite objective', () => {
  const tasks = [
    task('early'),
    task('near', { minPlayerLevel: 3 }),
    task('late', { minPlayerLevel: 40 }),
    task(collector),
  ];
  const { profile, priorities } = context(tasks);
  const rank = (demands) => firItemPriority(demands, priorities(), profile, false, collector);
  assert.ok(
    compareLockRank(rank([demand('early'), demand('late')]).rank, rank([demand('near')]).rank) < 0,
  );
  profile.objectiveCounts['early:item'] = 1;
  profile.favorites = ['early'];
  assert.equal(rank([demand('early'), demand('late')]).favorite, false);
  assert.ok(
    compareLockRank(rank([demand('early'), demand('late')]).rank, rank([demand('near')]).rank) > 0,
  );
  assert.ok(
    compareLockRank(
      rank([demand('early', 2), demand(collector)]).rank,
      rank([demand(collector)]).rank,
    ) < 0,
  );
});

test('within a stage LL and required level decide order; manually accepted unknown tasks are current needs', () => {
  const tasks = [
    task('ll1', { supplementLoyaltyLevel: 1, minPlayerLevel: 40 }),
    task('ll2', { supplementLoyaltyLevel: 2, minPlayerLevel: 30 }),
    task('ll1-later', { supplementLoyaltyLevel: 1, minPlayerLevel: 50 }),
    task('unknown', { otherRequirements: [{ type: 'dialogue' }] }),
  ];
  const { profile, priorities } = context(tasks);
  const values = priorities();
  assert.ok(compareLockRank(values.get('ll1').rank, values.get('ll2').rank) < 0);
  assert.ok(compareLockRank(values.get('ll1').rank, values.get('ll1-later').rank) < 0);
  profile.tasks.unknown = 'active';
  assert.equal(priorities().get('unknown').rank[0], 0);
});

test('nearby unlock thresholds consider all shortages, including verified completion counts', () => {
  const near = task('near', {
    minPlayerLevel: 6,
    otherRequirements: [{ id: 'count', type: 'globalVariable', compareMethod: '>=', value: 3 }],
  });
  const far = task('far', {
    ...near,
    id: 'far',
    otherRequirements: [{ ...near.otherRequirements[0], value: 4 }],
  });
  const { profile, snapshot } = context([near, far]);
  const result = (t) => ({
    state: 'blocked',
    conditions: [
      { kind: 'playerLevel', state: 'unmet' },
      {
        kind: 'globalVariable',
        state: 'unmet',
        reference: `${t.id}:count`,
        counter: { derived: true, completed: 0, required: t.otherRequirements[0].value },
      },
    ],
  });
  assert.equal(firTaskPriority(near, profile, snapshot, result(near)).rank[0], 1);
  assert.equal(firTaskPriority(far, profile, snapshot, result(far)).rank[0], 2);
});
