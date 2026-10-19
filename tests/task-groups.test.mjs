import test from 'node:test';
import assert from 'node:assert/strict';
import { taskLock, compareLockRank, compareTaskMaps } from '../src/domain/task-groups.ts';
import { evaluateAvailability } from '../src/domain/progression.ts';
import { createProfile } from '../src/domain/profiles.ts';

const task = (id, fields = {}) => ({
  id,
  name: id,
  trader: 'trader',
  objectives: [],
  taskRequirements: [],
  traderRequirements: [],
  ...fields,
});
const snapshot = (tasks) => ({
  tasks,
  traders: [{ id: 'trader', levels: [] }],
  maps: [
    { id: 'woods', name: 'Woods' },
    { id: 'customs', name: 'Customs' },
  ],
});
const lock = (t, p, tasks = [t]) => taskLock(t, p, evaluateAvailability(t, p), snapshot(tasks));

test('locked tasks move between shortage groups as conditions are satisfied', () => {
  const p = createProfile('regular', null);
  p.level = 1;
  p.traders.trader = { level: 1 };
  const t = task('t', {
    minPlayerLevel: 10,
    taskRequirements: [{ task: 'a', status: ['complete'] }],
    traderRequirements: [
      { trader: 'trader', requirementType: 'level', compareMethod: '>=', value: 2 },
    ],
  });
  assert.equal(lock(t, p).group, 'multiple');
  p.level = 10;
  p.tasks.a = 'complete';
  assert.equal(lock(t, p).group, 'level');
  p.traders.trader.level = 2;
  assert.equal(lock(t, p), undefined);
  p.level = 1;
  assert.equal(lock(t, p).group, 'playerLevel');
  p.taskAvailabilityOverrides = { t: 'available' };
  assert.equal(lock(t, p), undefined);
  delete p.taskAvailabilityOverrides;
  p.tasks.t = 'complete';
  assert.equal(lock(t, p), undefined);
});

test('level and LL groups order by the lower required threshold', () => {
  const p = createProfile('regular', null);
  p.level = 1;
  p.traders.trader = { level: 1 };
  const level10 = task('ten', { minPlayerLevel: 10 }),
    level20 = task('twenty', { minPlayerLevel: 20 });
  assert.ok(compareLockRank(lock(level10, p).rank, lock(level20, p).rank) < 0);
  const ll = (value) =>
    task(String(value), {
      traderRequirements: [
        { trader: 'trader', requirementType: 'level', compareMethod: '>=', value },
      ],
    });
  assert.ok(compareLockRank(lock(ll(2), p).rank, lock(ll(4), p).rank) < 0);
});

test('verified counters sort by remaining tasks and honor strict greater-than thresholds', () => {
  const p = createProfile('regular', null);
  p.progressionRuleRevision = 'r';
  p.progressionCounters = {
    counter: {
      revision: 'r',
      verification: 'verified',
      coverage: 'complete',
      taskIds: ['a', 'b', 'c', 'd', 'e'],
      proof: [],
    },
  };
  p.tasks.a = 'complete';
  const gate = (id, value, compareMethod = '>=') =>
    task(id, {
      otherRequirements: [
        { id: 'gate', type: 'globalVariable', variableId: 'counter', value, compareMethod },
      ],
    });
  const two = gate('two', 2),
    four = gate('four', 3, '>');
  assert.equal(lock(two, p).group, 'count');
  assert.match(lock(four, p).hint, /あと3タスク/);
  assert.ok(compareLockRank(lock(two, p).rank, lock(four, p).rank) < 0);
  p.tasks.b = 'complete';
  assert.equal(lock(two, p), undefined);
  assert.equal(lock(four, p).group, 'count');
});

test('prerequisite ordering counts unique unfinished ancestors and tolerates cycles', () => {
  const p = createProfile('regular', null);
  const needs = (id) => [{ task: id, status: ['complete'] }];
  const a = task('a'),
    b = task('b', { taskRequirements: needs('a') }),
    c = task('c', { taskRequirements: needs('b') });
  const tasks = [a, b, c];
  assert.equal(lock(b, p, tasks).group, 'task');
  assert.ok(compareLockRank(lock(b, p, tasks).rank, lock(c, p, tasks).rank) < 0);
  p.tasks.a = 'complete';
  assert.equal(lock(b, p, tasks), undefined);
  assert.match(lock(c, p, tasks).hint, /前提 1件/);
  a.taskRequirements = needs('c');
  delete p.tasks.a;
  assert.ok(Number.isFinite(lock(c, p, tasks).rank[0]));
});

test('unknown gates and missing input do not masquerade as a known shortage', () => {
  const p = createProfile('regular', null);
  const t = task('t', { minPlayerLevel: 10 });
  assert.equal(lock(t, p).group, 'unknown');
  p.level = 1;
  t.otherRequirements = [{ type: 'dialogue' }];
  assert.equal(lock(t, p).group, 'multiple');
  const count = task('opaque', {
    otherRequirements: [
      { type: 'globalVariable', variableId: 'opaque', value: 5, compareMethod: '>=' },
    ],
  });
  assert.equal(lock(count, p).group, 'unknown');
});

test('map sorting uses visible map names and puts unspecified maps last ascending', () => {
  const s = snapshot([]),
    woods = task('woods', { map: 'woods' }),
    customs = task('customs', { map: 'customs' }),
    hidden = task('hidden', { map: '59fc81d786f774390775787e' });
  assert.ok(compareTaskMaps(customs, woods, s) < 0);
  assert.ok(compareTaskMaps(woods, hidden, s) < 0);
  assert.equal(compareTaskMaps(hidden, task('none'), s), 0);
});
