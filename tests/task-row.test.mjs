import test from 'node:test';
import assert from 'node:assert/strict';
import { taskFirEntries, taskSummary } from '../src/domain/task-row.ts';
import { setFirGroupCount } from '../src/domain/items.ts';
import { createProfile } from '../src/domain/profiles.ts';

test('row FiR counters share objective allocations with the FiR page and keep alternatives as one total', () => {
  const task = {
    id: 'task',
    name: 'Task',
    objectives: [
      {
        id: 'find',
        type: 'findItem',
        foundInRaid: true,
        count: 3,
        items: ['a', 'b'],
        description: 'Find',
      },
      {
        id: 'give',
        type: 'giveItem',
        foundInRaid: true,
        count: 3,
        items: ['a', 'b', 'a'],
        description: 'Give',
      },
      {
        id: 'optional',
        type: 'giveItem',
        foundInRaid: true,
        count: 2,
        item: 'c',
        optional: true,
        description: 'Optional',
      },
      { id: 'ordinary', type: 'giveItem', count: 2, item: 'c', description: 'Ordinary' },
    ],
  };
  let p = createProfile('regular', null);
  p = setFirGroupCount(p, [{ taskId: 'task', taskName: 'Task', objectiveId: 'give', count: 3 }], 2);
  const entries = taskFirEntries(task, p.objectiveCounts);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].items, ['a', 'b']);
  assert.equal(entries[0].maximum, 3);
  assert.equal(entries[0].value, 2);
  assert.equal(entries[0].key, 'task:give');
  assert.equal(p.tasks.task, undefined);
  assert.equal(taskSummary(task), 'Find / Give / Ordinary');
});

test('row FiR counts are bounded and unknown quantities are not invented', () => {
  const task = {
    id: 'task',
    objectives: [
      {
        id: 'known',
        type: 'giveItem',
        foundInRaid: true,
        count: 2,
        item: 'a',
        description: 'Known',
      },
      {
        id: 'unknown',
        type: 'giveItem',
        foundInRaid: true,
        count: null,
        items: ['b'],
        description: 'Unknown',
      },
    ],
  };
  const entries = taskFirEntries(task, { 'task:known': 99 });
  assert.equal(entries[0].value, 2);
  assert.equal(entries[1].maximum, undefined);
  assert.equal(entries[1].value, 0);
});
