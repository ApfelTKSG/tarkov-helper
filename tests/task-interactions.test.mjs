import test from 'node:test';
import assert from 'node:assert/strict';
import { interactingTaskIds } from '../src/domain/task-view.ts';

const task = (id, trader, previous = []) => ({
  id,
  trader,
  taskRequirements: previous.map((task) => ({ task, status: ['complete'] })),
});

test('cross-trader lines include their earlier and later tasks and connected branches', () => {
  const tasks = [
    task('a', 'one'),
    task('b', 'one', ['a']),
    task('c', 'two', ['b']),
    task('d', 'two', ['c']),
    task('branch', 'one', ['a']),
    task('isolated', 'two'),
    task('other-line', 'one'),
    task('other-next', 'one', ['other-line']),
  ];
  for (const catalogue of [tasks, [...tasks].reverse()])
    assert.deepEqual([...interactingTaskIds(catalogue)].sort(), ['a', 'b', 'branch', 'c', 'd']);
});

test('single-trader cycles and missing references do not create interactions', () => {
  const tasks = [
    task('a', 'one', ['b']),
    task('b', 'one', ['a']),
    task('missing', 'two', ['absent']),
  ];
  assert.equal(interactingTaskIds(tasks).size, 0);
  tasks[1].trader = 'two';
  assert.deepEqual([...interactingTaskIds(tasks)].sort(), ['a', 'b']);
});

test('failure dependencies are interactions, shared counter conditions are not graph edges', () => {
  const a = task('a', 'one'),
    b = task('b', 'two', ['a']),
    c = task('c', 'three');
  b.taskRequirements[0].status = ['failed'];
  a.otherRequirements = c.otherRequirements = [{ id: 'shared', type: 'globalVariable' }];
  assert.deepEqual([...interactingTaskIds([a, b, c])].sort(), ['a', 'b']);
});
