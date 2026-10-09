import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { taskVariantLabel } from '../src/domain/task-variant.ts';

test('same-name BTR tasks retain distinct prerequisite route labels, including downstream variants', () => {
  const manifest = JSON.parse(fs.readFileSync('public/game-data/manifest.json', 'utf8'));
  const { tasks } = JSON.parse(
    fs.readFileSync(`public/game-data/${manifest.modes.regular.file}`, 'utf8'),
  );
  const batteries = tasks.filter((t) => t.englishName === 'Battery Change');
  const endings = tasks.filter((t) => t.englishName === 'The Price of Independence');
  assert.equal(batteries.length, 2);
  assert.equal(endings.length, 2);
  for (const variants of [batteries, endings]) {
    const labels = variants.map((t) => taskVariantLabel(t, tasks));
    assert.equal(new Set(labels).size, 2);
    assert.ok(labels.some((label) => label.includes('Stick in the Wheel')));
    assert.ok(labels.some((label) => label.includes('Stabilize Business')));
  }
  assert.equal(
    taskVariantLabel(
      tasks.find((t) => t.englishName === 'Discombobulate'),
      tasks,
    ),
    undefined,
  );
});

test('missing and cyclic route data have bounded, distinguishable fallbacks', () => {
  const base = { trader: 'trader', name: 'Same', englishName: 'Same' };
  const tasks = [
    { ...base, id: 'first', taskRequirements: [{ task: 'second' }] },
    { ...base, id: 'second', taskRequirements: [{ task: 'first' }] },
  ];
  assert.ok(taskVariantLabel(tasks[0], tasks).length < 300);
  assert.notEqual(taskVariantLabel(tasks[0], tasks), taskVariantLabel(tasks[1], tasks));
  assert.equal(taskVariantLabel({ ...base, id: 'only', taskRequirements: [] }, []), undefined);
});
