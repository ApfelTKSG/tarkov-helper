import test from 'node:test';
import assert from 'node:assert/strict';
import { compareGraphTasks, prerequisiteProgress } from '../src/domain/task-order.ts';

test('PMC level precedes prerequisite count; ties use stable IDs', () => {
  const tasks = [
    { id: 'late', minPlayerLevel: 20, taskRequirements: [] },
    { id: 'more', minPlayerLevel: 10, taskRequirements: [{}, {}] },
    { id: 'z', minPlayerLevel: 10, taskRequirements: [{}] },
    { id: 'a', minPlayerLevel: 10, taskRequirements: [{}] },
    { id: 'none', taskRequirements: [] },
  ];
  assert.deepEqual(
    tasks.sort(compareGraphTasks).map((t) => t.id),
    ['none', 'a', 'z', 'more', 'late'],
  );
});
test('prerequisite count respects active, failed and complete alternatives without inferring progress', () => {
  const task = {
    taskRequirements: [
      { task: 'a', status: ['active', 'complete'] },
      { task: 'b', status: ['failed'] },
      { task: 'c', status: ['complete'] },
      { task: 'missing', status: ['complete'] },
    ],
  };
  assert.deepEqual(prerequisiteProgress(task, { a: 'active', b: 'failed', c: 'active' }), {
    met: 2,
    total: 4,
  });
  assert.deepEqual(prerequisiteProgress(task, {}), { met: 0, total: 4 });
  assert.deepEqual(prerequisiteProgress({ taskRequirements: [] }, {}), { met: 0, total: 0 });
});
