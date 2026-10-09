import test from 'node:test';
import assert from 'node:assert/strict';
import { interactingTaskIds, taskDepths, traderTaskLines } from '../src/domain/task-view.ts';

test('trader lines include local branches while foreign-only and independent tasks stay in LL columns', () => {
  const tasks = [
    task('root', 'one'),
    task('child', 'one', ['root']),
    task('branch', 'one', ['root']),
    task('end', 'one', ['child']),
    task('alone', 'one'),
    task('foreign', 'two'),
    task('foreign-only', 'one', ['foreign']),
  ];
  const lines = traderTaskLines(tasks, 'one');
  assert.deepEqual([...lines.connected].sort(), ['branch', 'child', 'end', 'root']);
  assert.equal(lines.depths.get('root'), 0);
  assert.equal(lines.depths.get('child'), 1);
  assert.equal(lines.depths.get('branch'), 1);
  assert.equal(lines.depths.get('end'), 2);
  assert.equal(lines.depths.get('foreign-only'), 0);
  assert.ok(!lines.depths.has('foreign'));
});

test('depth follows the longest prerequisite route across traders and merges', () => {
  const tasks = [
    task('root', 'one'),
    task('second', 'two', ['root']),
    task('third', 'one', ['second']),
    task('other-root', 'three'),
    task('merge', 'two', ['third', 'other-root']),
  ];
  for (const catalogue of [tasks, [...tasks].reverse()]) {
    const depths = taskDepths(catalogue);
    assert.equal(depths.get('root'), 0);
    assert.equal(depths.get('other-root'), 0);
    assert.equal(depths.get('second'), 1);
    assert.equal(depths.get('third'), 2);
    assert.equal(depths.get('merge'), 3);
  }
});

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
