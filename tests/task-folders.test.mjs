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

test('folders contain ordered maximal lines with at least two members', () => {
  const tasks = line();
  const folders = taskFolders([...tasks].reverse());
  assert.deepEqual(
    folders.map((f) => f.tasks.map((t) => t.id)),
    [['a', 'b', 'c', 'd']],
  );
  assert.equal(taskFolders(tasks.slice(0, 2)).length, 1);
  assert.equal(taskFolders(tasks.slice(0, 1)).length, 0);
});
test('a branch at the start splits lines and multiple prerequisites stay outside', () => {
  const tasks = line();
  tasks.push(task('branch', ['a']));
  assert.deepEqual(
    taskFolders(tasks).map((f) => f.tasks.map((t) => t.id)),
    [['b', 'c', 'd']],
  );
  tasks[2].taskRequirements.push({ task: 'branch', status: ['complete'] });
  assert.equal(taskFolders(tasks).length, 0);
});

test('a branch point ends its incoming folder without choosing a successor', () => {
  const tasks = [...line(), task('left', ['d']), task('left-next', ['left']), task('right', ['d'])];
  for (const catalogue of [tasks, [...tasks].reverse()]) {
    const folders = taskFolders(catalogue);
    assert.deepEqual(
      folders.find((f) => f.tasks[0].id === 'a').tasks.map((t) => t.id),
      ['a', 'b', 'c', 'd'],
    );
    assert.deepEqual(
      folders.find((f) => f.tasks[0].id === 'left').tasks.map((t) => t.id),
      ['left', 'left-next'],
    );
    assert.ok(!folders.some((f) => f.tasks.some((t) => t.id === 'right')));
    assert.equal(new Set(folders.flatMap((f) => f.tasks.map((t) => t.id))).size, 6);
  }
});

test('Health Care Privacy Part 4 stays at the end of the Part 1 folder in every mode', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/game-data/manifest.json', import.meta.url)),
  );
  for (const mode of ['regular', 'pve', 'pvp-season']) {
    const snapshot = JSON.parse(
      await readFile(new URL(`../public/game-data/${manifest.modes[mode].file}`, import.meta.url)),
    );
    const folder = taskFolders(snapshot.tasks).find(
      (f) => f.tasks[0].englishName === 'Health Care Privacy - Part 1',
    );
    assert.deepEqual(
      folder.tasks.map((t) => t.englishName),
      [1, 2, 3, 4].map((n) => `Health Care Privacy - Part ${n}`),
    );
    const end = folder.tasks.at(-1);
    assert.ok(
      snapshot.tasks.filter(
        (t) => t.trader === end.trader && t.taskRequirements.some((r) => r.task === end.id),
      ).length > 1,
    );
  }
});
test('external prerequisites exclude members while foreign successors do not split lines', () => {
  const tasks = line();
  tasks.push(task('external', [], 1, 'other'), task('external-next', ['a'], 1, 'other'));
  tasks[3].taskRequirements.push({ task: 'external', status: ['complete'] });
  assert.deepEqual(
    taskFolders(tasks).map((f) => f.tasks.map((t) => t.id)),
    [['a', 'b', 'c']],
  );
  assert.equal(tasks[3].taskRequirements.length, 2); // eligibility still retains both gates
});
test('Higher They Fly and Choose Your Friends Wisely remain outside due to external gates', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/game-data/manifest.json', import.meta.url)),
  );
  for (const mode of ['regular', 'pve', 'pvp-season']) {
    const snapshot = JSON.parse(
      await readFile(new URL(`../public/game-data/${manifest.modes[mode].file}`, import.meta.url)),
    );
    const members = taskFolders(snapshot.tasks).flatMap((f) => f.tasks);
    assert.ok(!members.some((t) => t.englishName === 'The Higher They Fly'));
    assert.ok(!members.some((t) => t.englishName === 'Choose Your Friends Wisely'));
    // Seasonal API data no longer includes this line; regular and PvE still do.
    assert.equal(
      members.some((t) => t.englishName === 'Route Deviation'),
      snapshot.tasks.some((t) => t.englishName === 'Route Deviation'),
    );
  }
});
test('LL changes and unknown tiers do not split lines, trader changes do', () => {
  const tasks = line();
  tasks[2].traderRequirements[0].value = 2;
  assert.equal(taskFolders(tasks).length, 1);
  assert.deepEqual(taskFolders(tasks)[0].levels, [1, 2]);
  tasks[2].traderRequirements[0].value = 1;
  tasks[2].trader = 'other';
  assert.deepEqual(
    taskFolders(tasks).map((f) => f.tasks.map((t) => t.id)),
    [['a', 'b']],
  );
  tasks[2].trader = 'trader';
  for (const t of tasks) {
    t.traderRequirements = [];
    t.otherRequirements = [{ id: 'unknown' }];
  }
  assert.equal(taskFolders(tasks).length, 1);
  assert.deepEqual(taskFolders(tasks)[0].levels, [0]);
});
test('Punisher includes Part 6 across LL; folders exclude only incoming external gates', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/game-data/manifest.json', import.meta.url)),
  );
  for (const mode of ['regular', 'pve', 'pvp-season']) {
    const snapshot = JSON.parse(
      await readFile(new URL(`../public/game-data/${manifest.modes[mode].file}`, import.meta.url)),
    );
    const folders = taskFolders(snapshot.tasks);
    const folder = folders.find((f) => f.tasks[0].englishName === 'The Punisher - Part 1');
    for (const part of [1, 2, 3, 4, 5, 6])
      assert.ok(folder.tasks.some((t) => t.englishName === `The Punisher - Part ${part}`));
    assert.equal(folder.level, 1);
    assert.ok(folder.levels.includes(3));
    const byId = new Map(snapshot.tasks.map((t) => [t.id, t]));
    for (const f of folders)
      for (const member of f.tasks) {
        assert.ok(
          member.taskRequirements.every((req) => byId.get(req.task).trader === member.trader),
        );
      }
  }
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
