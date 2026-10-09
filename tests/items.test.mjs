import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingFirItems, setFirGroupCount } from '../src/domain/items.ts';

test('image counts allocate only the change, cap demand, and undo without touching other progress', () => {
  const p = createDatabase().profiles.regular;
  const demands = [
    { taskId: 'a', objectiveId: 'one', count: 2 },
    { taskId: 'b', objectiveId: 'two', count: 3 },
  ];
  p.objectiveCounts = { 'a:one': 1, 'b:two': 1, 'other:x': 4 };
  const next = setFirGroupCount(p, demands, 3);
  assert.deepEqual(next.objectiveCounts, { 'a:one': 2, 'b:two': 1, 'other:x': 4 });
  assert.deepEqual(setFirGroupCount(next, demands, 2).objectiveCounts, {
    'a:one': 2,
    'b:two': 0,
    'other:x': 4,
  });
  assert.equal(setFirGroupCount(p, demands, 6), p);
  assert.equal(setFirGroupCount(p, demands, -1), p);
  assert.equal(setFirGroupCount(p, demands, 1.5), p);
  p.tasks.a = 'complete';
  assert.equal(setFirGroupCount(p, demands, 2).objectiveCounts['a:one'], 1);
});

test('single-item image toggles can be undone and alternative candidates share one counter', () => {
  const p = createDatabase().profiles.regular;
  const demand = [{ taskId: 'a', objectiveId: 'alternative', count: 1 }];
  const done = setFirGroupCount(p, demand, 1);
  assert.equal(done.objectiveCounts['a:alternative'], 1);
  assert.equal(setFirGroupCount(done, demand, 0).objectiveCounts['a:alternative'], 0);
  assert.deepEqual(p.objectiveCounts, {});
});
import { createDatabase } from '../src/domain/profiles.ts';

test('remaining items aggregate repeated IDs while alternatives are one shared demand', () => {
  const tasks = [
    {
      id: 'first',
      name: 'First',
      objectives: [
        { id: 'a', type: 'giveItem', items: ['item'], count: 3, foundInRaid: true },
        { id: 'b', type: 'giveItem', items: ['item', 'other'], count: 5, foundInRaid: true },
        {
          id: 'optional',
          type: 'giveItem',
          items: ['item'],
          count: 10,
          foundInRaid: true,
          optional: true,
        },
      ],
    },
    {
      id: 'second',
      name: 'Second',
      objectives: [{ id: 'c', type: 'giveItem', item: 'item', count: 4, foundInRaid: true }],
    },
  ];
  const profile = createDatabase().profiles.regular;
  profile.objectiveCounts['first:a'] = 1;
  profile.objectiveCounts['first:b'] = 2;
  const result = remainingFirItems(tasks, profile);
  assert.equal(result.singles.length, 1);
  assert.equal(result.singles[0].count, 6);
  assert.equal(result.alternatives.length, 1);
  assert.equal(result.alternatives[0].demand.count, 3);
  profile.tasks.second = 'complete';
  assert.equal(remainingFirItems(tasks, profile).singles[0].count, 2);
});
