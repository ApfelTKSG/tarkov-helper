import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { taskLoyaltyColumn, taskLoyaltyPlacement } from '../src/domain/task-columns.ts';
import { evaluateAvailability } from '../src/domain/progression.ts';

const task = (id, level, requirements = [], trader = 'a') => ({
  id,
  trader,
  taskRequirements: requirements,
  traderRequirements: level
    ? [{ trader, requirementType: 'level', value: level, compareMethod: '>=' }]
    : [],
});
const complete = (id) => ({ task: id, status: ['complete'] });

test('inherits maximum LL through multiple predecessors and generations', () => {
  const a = task('a', 4),
    b = task('b', 0, [complete('a')]),
    c = task('c', 0, [complete('b')]);
  const low = task('low', 2);
  c.taskRequirements.push(complete('low'));
  assert.equal(taskLoyaltyColumn(b, [a, b, c, low]), 4);
  assert.deepEqual(taskLoyaltyPlacement(c, [a, b, c, low]), {
    level: 4,
    inheritedFrom: [{ id: 'a', level: 4 }],
  });
  assert.equal(taskLoyaltyColumn(c, [a, b, c, low]), 4); // full catalogue, independent of displayed filters
});
test('other trader LL is not reused; target-trader gates may be inherited across traders', () => {
  const foreign = task('foreign', 4, [], 'other');
  const root = task('root', 0, [complete('foreign')]);
  assert.equal(taskLoyaltyColumn(root, [root, foreign]), 1);
  foreign.traderRequirements.push({
    trader: 'a',
    requirementType: 'level',
    value: 3,
    compareMethod: '>=',
  });
  assert.equal(taskLoyaltyColumn(root, [root, foreign]), 3);
});
test('active prerequisites may inherit; failed alternatives do not; cycles and missing tasks terminate', () => {
  const a = task('a', 4),
    b = task('b', 0, [{ task: 'a', status: ['active', 'complete'] }]);
  assert.equal(taskLoyaltyColumn(b, [a, b]), 4);
  b.taskRequirements[0].status.push('failed');
  assert.equal(taskLoyaltyColumn(b, [a, b]), 1);
  b.taskRequirements = [complete('a')];
  a.taskRequirements = [complete('b'), complete('missing')];
  assert.equal(taskLoyaltyColumn(b, [a, b]), 4);
});
test('inherited display LL never adds a current eligibility gate to completed history', () => {
  const a = task('a', 4),
    b = task('b', 0, [complete('a')]);
  assert.equal(taskLoyaltyColumn(b, [a, b]), 4);
  assert.equal(
    evaluateAvailability(b, { tasks: { a: 'complete' }, traders: { a: { level: 1 } } }).state,
    'eligible',
  );
});
test('actual Punisher Parts 5 and 6 follow Part 4 into LL4 in every mode', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../public/game-data/manifest.json', import.meta.url)),
  );
  for (const mode of ['regular', 'pve', 'pvp-season']) {
    const snapshot = JSON.parse(
      await readFile(new URL(`../public/game-data/${manifest.modes[mode].file}`, import.meta.url)),
    );
    for (const number of [5, 6]) {
      const t = snapshot.tasks.find((t) => t.englishName === `The Punisher - Part ${number}`);
      assert.equal(taskLoyaltyColumn(t, snapshot.tasks), 4);
      assert.ok(
        taskLoyaltyPlacement(t, snapshot.tasks).inheritedFrom.some(
          (s) => s.id === '59ca264786f77445a80ed044',
        ),
      );
    }
  }
});
