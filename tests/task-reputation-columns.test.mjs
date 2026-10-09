import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase, parseDatabase } from '../src/domain/profiles.ts';
import { changeTaskState, toggleTaskCompletion } from '../src/domain/task-reputation.ts';
import { taskLoyaltyColumn } from '../src/domain/task-columns.ts';

const task = () => ({
  id: 'task',
  trader: 'a',
  taskRequirements: [],
  traderRequirements: [],
  finishRewards: {
    traderStanding: [
      { trader: 'a', standing: 0.1 },
      { trader: 'b', standing: -0.02 },
    ],
  },
  failureOutcome: { traderStanding: [{ trader: 'a', standing: -0.03 }] },
});

test('quick completion toggles progress and reverses rewards while preserving manual reputation edits', () => {
  const original = createDatabase().profiles.regular;
  original.tasks.task = 'active';
  original.traders.a = { reputation: 0.2 };
  const completed = toggleTaskCompletion(original, task());
  assert.equal(completed.tasks.task, 'complete');
  assert.ok(completed.completedAt.task);
  assert.equal(completed.traders.a.reputation, 0.3);
  completed.traders.a.reputation = 0.5;
  const undone = toggleTaskCompletion(completed, task());
  assert.equal(undone.tasks.task, 'active');
  assert.equal(undone.completedAt.task, undefined);
  assert.equal(undone.traders.a.reputation, 0.4);
  assert.equal(original.tasks.task, 'active');
});
test('completion applies all signed rewards once and undo preserves manual adjustments', () => {
  let p = createDatabase().profiles.regular;
  p.traders.a = { reputation: 0.2, level: 2, unlocked: true };
  p = changeTaskState(p, task(), 'complete');
  assert.equal(p.traders.a.reputation, 0.3);
  assert.equal(p.traders.b.reputation, -0.02);
  assert.equal(changeTaskState(p, task(), 'complete'), p);
  p.traders.a.reputation = 0.45; // daily quest/manual correction
  p = changeTaskState(p, task(), 'active');
  assert.equal(p.traders.a.reputation, 0.35);
  assert.equal(p.traders.b.reputation, 0);
  assert.equal(p.traders.a.level, 2);
  assert.equal(p.completedAt.task, undefined);
});

test('completion undo restores unavailable, accepted and failed states after backup reload', () => {
  for (const state of ['unstarted', 'active', 'failed']) {
    const db = createDatabase();
    let original = db.profiles.regular;
    original.traders.a = { reputation: 0.2 };
    if (state !== 'unstarted') original = changeTaskState(original, task(), state);
    db.profiles.regular = toggleTaskCompletion(original, task());
    const reloaded = parseDatabase(JSON.stringify(db)).profiles.regular;
    assert.equal(reloaded.taskStateBeforeCompletion.task, state);
    const undone = toggleTaskCompletion(reloaded, task());
    assert.equal(undone.tasks.task, state);
    assert.equal(undone.taskStateBeforeCompletion.task, undefined);
    assert.equal(undone.traders.a.reputation, original.traders.a.reputation);
    assert.equal(undone.completedAt.task, undefined);
    assert.equal(
      toggleTaskCompletion(toggleTaskCompletion(undone, task()), task()).tasks.task,
      state,
    );
  }
  const db = createDatabase();
  db.profiles.regular.tasks.task = 'complete';
  assert.equal(toggleTaskCompletion(db.profiles.regular, task()).tasks.task, 'unstarted');
  db.profiles.regular.taskStateBeforeCompletion = { task: 'complete' };
  assert.throws(() => parseDatabase(JSON.stringify(db)));
});
test('failure replaces completion, reversing recorded rewards despite API changes', () => {
  let p = changeTaskState(createDatabase().profiles.regular, task(), 'complete');
  const updated = task();
  updated.finishRewards.traderStanding[0].standing = 0.5;
  p = changeTaskState(p, updated, 'failed');
  assert.equal(p.traders.a.reputation, -0.03);
  p = changeTaskState(p, updated, 'unstarted');
  assert.equal(p.traders.a.reputation, 0);
});
test('existing completed progress is not retroactively added or subtracted; ledger survives restore', () => {
  const d = createDatabase();
  d.profiles.regular.tasks.task = 'complete';
  d.profiles.regular.traders.a = { reputation: 0.7 };
  let p = changeTaskState(d.profiles.regular, task(), 'complete');
  p = changeTaskState(p, task(), 'active');
  assert.equal(p.traders.a.reputation, 0.7);
  d.profiles.regular = changeTaskState(p, task(), 'complete');
  assert.deepEqual(parseDatabase(JSON.stringify(d)), d);
  d.profiles.regular.taskReputation.task.a = Infinity;
  assert.throws(() => parseDatabase(JSON.stringify(d)));
});
test('LL columns use own trader gate and keep opaque gates unknown', () => {
  const t = task();
  assert.equal(taskLoyaltyColumn(t), 1);
  t.otherRequirements = [{ type: 'globalVariable' }];
  assert.equal(taskLoyaltyColumn(t), 0);
  t.traderRequirements = [
    { trader: 'a', requirementType: 'level', value: 2, compareMethod: '>=' },
    { trader: 'b', requirementType: 'level', value: 4, compareMethod: '>=' },
  ];
  assert.equal(taskLoyaltyColumn(t), 2);
  t.traderRequirements[0].compareMethod = '>';
  assert.equal(taskLoyaltyColumn(t), 3);
  t.traderRequirements[0].value = 4;
  assert.equal(taskLoyaltyColumn(t), 0);
});
