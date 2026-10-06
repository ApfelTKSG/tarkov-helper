import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { taskFolders, visibleTaskFolders } from '../src/domain/task-folders.ts';

const task = (id, previous = [], level = 1, trader = 'trader') => ({
  id,
  name: id,
  trader,
  taskRequirements: previous.map((task) => ({ task, status: ['complete'] })),
  traderRequirements: [{ trader, requirementType: 'level', compareMethod: '>=', value: level }],
});
const line = () => [task('a'), task('b', ['a']), task('c', ['b']), task('d', ['c'])];

test('folders contain ordered maximal lines with at least three members', () => {
  const tasks = line();
  const folders = taskFolders([...tasks].reverse());
  assert.deepEqual(
    folders.map((f) => f.tasks.map((t) => t.id)),
    [['a', 'b', 'c', 'd']],
  );
  assert.equal(taskFolders(tasks.slice(0, 2)).length, 0);
});
test('same-trader branch and merge boundaries remain individual', () => {
  const tasks = line();
  tasks.push(task('branch', ['a']));
  assert.deepEqual(
    taskFolders(tasks).map((f) => f.tasks.map((t) => t.id)),
    [['b', 'c', 'd']],
  );
  tasks[2].taskRequirements.push({ task: 'branch', status: ['complete'] });
  assert.equal(taskFolders(tasks).length, 0);
});
test('external prerequisites and successors do not split a trader line', () => {
  const tasks = line();
  tasks.push(task('external', [], 1, 'other'), task('external-next', ['a'], 1, 'other'));
  tasks[3].taskRequirements.push({ task: 'external', status: ['complete'] });
  assert.deepEqual(
    taskFolders(tasks).map((f) => f.tasks.map((t) => t.id)),
    [['a', 'b', 'c', 'd']],
  );
  assert.equal(tasks[3].taskRequirements.length, 2); // eligibility still retains both gates
});
test('Higher They Fly includes Choose Your Friends Wisely in every mode', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/game-data/manifest.json', import.meta.url)),
  );
  for (const mode of ['regular', 'pve', 'pvp-season']) {
    const snapshot = JSON.parse(
      await readFile(new URL(`../public/game-data/${manifest.modes[mode].file}`, import.meta.url)),
    );
    const folder = taskFolders(snapshot.tasks).find(
      (f) => f.tasks[0].englishName === 'The Higher They Fly',
    );
    assert.equal(folder.tasks.length, 6);
    assert.equal(folder.tasks.at(-1).englishName, 'Choose Your Friends Wisely');
    assert.equal(folder.tasks.at(-1).taskRequirements.length, 2);
  }
});
test('different LL and trader split lines, unknown tiers never become folders', () => {
  const tasks = line();
  tasks[2].traderRequirements[0].value = 2;
  assert.equal(taskFolders(tasks).length, 0);
  tasks[2].traderRequirements[0].value = 1;
  tasks[2].trader = 'other';
  assert.equal(taskFolders(tasks).length, 0);
  for (const t of tasks) {
    t.traderRequirements = [];
    t.otherRequirements = [{ id: 'unknown' }];
  }
  assert.equal(taskFolders(tasks).length, 0);
});
test('cycles, missing predecessors, and failure alternatives do not become folders', () => {
  const tasks = line();
  tasks[0].taskRequirements = [{ task: 'd', status: ['complete'] }];
  assert.equal(taskFolders(tasks).length, 0);
  tasks[0].taskRequirements = [{ task: 'missing', status: ['complete'] }];
  assert.deepEqual(
    taskFolders(tasks)[0].tasks.map((t) => t.id),
    ['b', 'c', 'd'],
  );
  tasks[2].taskRequirements[0].status.push('failed');
  assert.equal(taskFolders(tasks).length, 0);
});
test('partial filters use individual nodes; search and selection force expansion', () => {
  const tasks = line(),
    folders = taskFolders(tasks),
    id = folders[0].id;
  assert.equal(visibleTaskFolders(folders, tasks.slice(1), new Set(), false).length, 0);
  assert.equal(visibleTaskFolders(folders, tasks, new Set(), false)[0].expanded, false);
  assert.equal(visibleTaskFolders(folders, tasks, new Set([id]), false)[0].expanded, true);
  assert.equal(visibleTaskFolders(folders, tasks, new Set(), true)[0].expanded, true);
  assert.equal(visibleTaskFolders(folders, tasks, new Set(), false, 'c')[0].expanded, true);
  assert.equal(visibleTaskFolders(folders, tasks, new Set(), false, 'outside')[0].expanded, false);
});
