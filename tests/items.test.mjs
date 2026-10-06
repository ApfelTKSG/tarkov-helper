import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingFirItems } from '../src/domain/items.ts';
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
