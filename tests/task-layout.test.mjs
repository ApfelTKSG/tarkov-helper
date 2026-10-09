import test from 'node:test';
import assert from 'node:assert/strict';
import { layeredTaskRows } from '../src/domain/task-layout.ts';
import { ancestorIds, descendantIds } from '../src/domain/task-view.ts';

const task = (id, previous = []) => ({
  id,
  minPlayerLevel: 0,
  taskRequirements: previous.map((task) => ({ task, status: ['complete'] })),
});

test('hover follows prerequisites and successors without highlighting sibling branches', () => {
  const tasks = [task('a'), task('b', ['a']), task('c', ['b']), task('branch', ['a'])];
  assert.deepEqual([...ancestorIds(tasks, 'b')].sort(), ['a', 'b']);
  assert.deepEqual([...descendantIds(tasks, 'b')].sort(), ['b', 'c']);
  tasks[0].taskRequirements.push({ task: 'c', status: ['complete'] });
  assert.deepEqual([...descendantIds(tasks, 'b')].sort(), ['a', 'b', 'branch', 'c']);
});

test('disconnected lines occupy separate bands and straight chains remain aligned', () => {
  const tasks = [task('a'), task('b', ['a']), task('c', ['b']), task('x'), task('y', ['x'])];
  const layers = new Map([
    ['a', 0],
    ['b', 1],
    ['c', 2],
    ['x', 0],
    ['y', 1],
  ]);
  const rows = layeredTaskRows(tasks, layers);
  assert.equal(rows.get('a'), rows.get('b'));
  assert.equal(rows.get('b'), rows.get('c'));
  assert.equal(rows.get('x'), rows.get('y'));
  assert.ok(rows.get('x') > rows.get('c') + 1);
  assert.deepEqual(layeredTaskRows([...tasks].reverse(), layers), rows);
});

test('branch ordering removes crossed edges instead of ordering nodes independently', () => {
  const tasks = [
    task('a'),
    task('b'),
    task('c', ['b']),
    task('d', ['a']),
    task('merge', ['c', 'd']),
  ];
  const layers = new Map([
    ['a', 0],
    ['b', 0],
    ['c', 1],
    ['d', 1],
    ['merge', 2],
  ]);
  const rows = layeredTaskRows(tasks, layers);
  assert.ok((rows.get('a') - rows.get('b')) * (rows.get('d') - rows.get('c')) > 0);
  assert.notEqual(rows.get('a'), rows.get('b'));
  assert.notEqual(rows.get('c'), rows.get('d'));
  assert.equal(rows.size, tasks.length);
});
