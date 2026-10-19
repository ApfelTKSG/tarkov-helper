import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loyaltyGoal,
  unlockMilestones,
  taskUnlockImpact,
  isActionable,
  countCohortLabel,
} from '../src/domain/trader-dashboard.ts';
import { evaluateAvailability } from '../src/domain/progression.ts';
import { createProfile, createDatabase, parseDatabase } from '../src/domain/profiles.ts';
import { toggleTaskCompletion } from '../src/domain/task-reputation.ts';

const trader = {
  id: 'trader',
  name: 'Trader',
  englishName: 'Trader',
  levels: [
    { level: 1, requiredPlayerLevel: 0, requiredReputation: 0 },
    { level: 2, requiredPlayerLevel: 10, requiredReputation: 0.7 },
    { level: 3, requiredPlayerLevel: 20, requiredReputation: 2 },
  ],
};
const task = (id, reward = 0.1) => ({
  id,
  name: id,
  englishName: id,
  trader: trader.id,
  taskRequirements: [],
  traderRequirements: [],
  objectives: [],
  finishRewards: { traderStanding: [{ trader: trader.id, standing: reward }] },
});
function profile() {
  const value = createProfile('regular', null);
  value.level = 5;
  value.traders.trader = { reputation: 0.2 };
  value.progressionRuleRevision = 'verified';
  value.progressionCounters = {
    count: {
      revision: 'verified',
      verification: 'verified',
      coverage: 'complete',
      taskIds: ['a', 'b', 'c', 'd'],
      proof: [],
    },
  };
  return value;
}
const gated = (id, required, operator = '>=') => ({
  ...task(id),
  otherRequirements: [
    {
      id: 'gate',
      type: 'globalVariable',
      variableId: 'count',
      compareMethod: operator,
      value: required,
    },
  ],
});

test('count cohort labels use the counted tasks, with no guessed LL for mixed or unknown cohorts', () => {
  const tasks = [
    { ...task('a'), supplementLoyaltyLevel: 1 },
    { ...task('b'), supplementLoyaltyLevel: 1 },
    { ...task('c'), supplementLoyaltyLevel: 2 },
    { ...task('unknown'), otherRequirements: [{ type: 'unknown' }] },
    { ...task('other'), trader: 'other-trader', supplementLoyaltyLevel: 1 },
  ];
  assert.equal(countCohortLabel(['a', 'b'], tasks), 'LL1のタスク');
  assert.equal(countCohortLabel(['c'], tasks), 'LL2のタスク');
  for (const ids of [[], ['missing'], ['a', 'c'], ['a', 'unknown'], ['a', 'other']])
    assert.equal(countCohortLabel(ids, tasks), '対象タスク');
});

test('LL target reports independent gaps and reward-based count without inferring future unlocks', () => {
  const p = profile();
  const tasks = [
    task('a', 0.3),
    task('b', 0.2),
    task('c', 0.1),
    task('negative', -0.4),
    task('done', 1),
  ];
  p.tasks.done = 'complete';
  const result = loyaltyGoal(trader, p, [...tasks, tasks[0]]);
  assert.equal(result.current.level, 1);
  assert.equal(result.target.level, 2);
  assert.equal(result.reputationGap, 0.5);
  assert.equal(result.playerLevelGap, 5);
  assert.equal(result.minimumTasks, 2);
  assert.deepEqual(
    result.plan.map((t) => t.id),
    ['a', 'b'],
  );
  assert.equal(result.availableReputation, 0.6);
  assert.equal(loyaltyGoal(trader, p, tasks, 3).minimumTasks, undefined);
  delete p.traders.trader.reputation;
  assert.equal(loyaltyGoal(trader, p, tasks).reputationGap, undefined);
  assert.equal(loyaltyGoal(trader, p, tasks).minimumTasks, undefined);
});

test('LL estimate does not count already failed tasks or claim new LL from reputation alone', () => {
  const p = profile();
  p.tasks.a = 'failed';
  assert.equal(loyaltyGoal(trader, p, [task('a', 10)]).minimumTasks, undefined);
  p.traders.trader.reputation = 0.7;
  const goal = loyaltyGoal(trader, p, []);
  assert.equal(goal.current.level, 1);
  assert.equal(goal.reputationGap, 0);
  assert.equal(goal.playerLevelGap, 5);
  assert.equal(goal.minimumTasks, 0);
  p.traders.trader.level = 3;
  assert.equal(loyaltyGoal(trader, p, []).target, undefined);
});

test('reputation choices include interchangeable rewards so the user can choose any required number', () => {
  const p = profile();
  p.traders.trader.reputation = 0;
  const tasks = ['a', 'b', 'c', 'd'].map((id) => task(id, 0.25));
  const result = loyaltyGoal(trader, p, [...tasks, task('small', 0.1)]);
  assert.equal(result.minimumTasks, 3);
  assert.equal(result.plan.length, 3);
  assert.deepEqual(
    result.choices.map((t) => t.id),
    ['a', 'b', 'c', 'd'],
  );
  p.tasks.a = 'complete';
  assert.deepEqual(
    loyaltyGoal(trader, p, tasks).choices.map((t) => t.id),
    ['b', 'c', 'd'],
  );
});

test('mixed reward choices never suggest arbitrary N tasks when the weakest N would fall short', () => {
  const p = profile();
  p.traders.trader.reputation = 0;
  const result = loyaltyGoal(trader, p, [
    task('a', 0.3),
    task('b', 0.25),
    task('c', 0.25),
    task('d', 0.2),
    task('e', 0.19),
  ]);
  assert.equal(result.minimumTasks, 3);
  assert.deepEqual(
    result.choices.map((t) => t.id),
    ['a', 'b', 'c', 'd'],
  );
  const needsLargest = loyaltyGoal(trader, p, [task('a', 0.5), task('b', 0.2), task('c', 0.2)]);
  assert.equal(needsLargest.minimumTasks, 2);
  assert.deepEqual(
    needsLargest.choices.map((t) => t.id),
    ['a', 'b'],
  );
  assert.deepEqual(loyaltyGoal(trader, p, [task('small', 0.1)]).choices, []);
});

test('shared count gates group targets, keep other gates, and ignore unresolved or non-monotonic counts', () => {
  const p = profile();
  p.tasks.a = 'complete';
  const targets = [
    gated('x', 3),
    { ...gated('y', 3), minPlayerLevel: 20 },
    gated('strict', 2, '>'),
    gated('equal', 4, '='),
  ];
  const milestones = unlockMilestones(targets, p, (t) => evaluateAvailability(t, p));
  assert.equal(milestones.length, 1);
  assert.equal(milestones[0].remaining, 2);
  assert.equal(milestones[0].completed, 1);
  assert.equal(milestones[0].targets.length, 3);
  assert.equal(milestones[0].targets.find((t) => t.task.id === 'y').otherConditions, true);
  assert.deepEqual(taskUnlockImpact('b', milestones), { count: 3, nearest: 2 });
  p.progressionCounters.count.verification = 'unresolved';
  assert.deepEqual(
    unlockMilestones(targets, p, (t) => evaluateAvailability(t, p)),
    [],
  );
});

test('completion and backup undo update trust and counts together without reapplying rewards', () => {
  let p = profile();
  const a = task('a', 0.3);
  const target = gated('target', 2);
  p = toggleTaskCompletion(p, a);
  assert.equal(p.traders.trader.reputation, 0.5);
  assert.equal(unlockMilestones([target], p, (t) => evaluateAvailability(t, p))[0].remaining, 1);
  const db = createDatabase();
  db.profiles.regular = p;
  p = parseDatabase(JSON.stringify(db)).profiles.regular;
  p = toggleTaskCompletion(p, a);
  assert.equal(p.traders.trader.reputation, 0.2);
  assert.equal(unlockMilestones([target], p, (t) => evaluateAvailability(t, p))[0].remaining, 2);
  p.tasks.target = 'active';
  assert.deepEqual(
    unlockMilestones([target], p, (t) => evaluateAvailability(t, p)),
    [],
  );
});

test('unknown and blocked tasks remain non-actionable until explicitly accepted', () => {
  const p = profile();
  const a = task('a');
  assert.equal(isActionable(a, p, { state: 'unknown' }), false);
  assert.equal(isActionable(a, p, { state: 'blocked' }), false);
  p.tasks.a = 'active';
  assert.equal(isActionable(a, p, { state: 'unknown' }), true);
  p.tasks.a = 'complete';
  assert.equal(isActionable(a, p, { state: 'eligible' }), false);
});

test('locked trader is not recommended before its unlock quest, while manual acceptance is respected', () => {
  const p = profile();
  const jaegerTask = { ...task('jaeger'), trader: '5c0647fdd443bc2504c2d371' };
  assert.equal(isActionable(jaegerTask, p, { state: 'eligible' }), false);
  p.tasks['5d2495a886f77425cd51e403'] = 'complete';
  assert.equal(isActionable(jaegerTask, p, { state: 'eligible' }), true);
  p.tasks['5d2495a886f77425cd51e403'] = 'unstarted';
  p.tasks.jaeger = 'active';
  assert.equal(isActionable(jaegerTask, p, { state: 'eligible' }), true);
});
