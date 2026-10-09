import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPrestige, newBeginningStage, prestigeCoverage } from '../src/domain/prestige.ts';
import { evaluateAvailability } from '../src/domain/progression.ts';
import { normalizeMode } from '../src/data/normalize.mjs';
import { supplementProgression } from '../src/data/progression-overlay.mjs';
import { makeFeeds } from './fixtures.mjs';
import { signedOverlay } from './overlay-fixture.mjs';

const beginning = (stage) => ({
  id: `nb${stage}`,
  wikiLink: `https://escapefromtarkov.fandom.com/wiki/New_Beginning_(Prestige_${stage})`,
});
test('New Beginning selects only the next prestige, without confusing ordinary prestige gates', () => {
  for (let current = 0; current < 6; current++) {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6].filter((stage) => matchesPrestige(beginning(stage), current)),
      [current + 1],
    );
  }
  assert.equal(matchesPrestige(beginning(2), undefined), true);
  assert.equal(matchesPrestige({ requiredPrestige: 2 }, 5), true);
  assert.equal(newBeginningStage(beginning(6)), 6);
  assert.equal(prestigeCoverage({ tasks: [beginning(1)] }, 1), false);
});
test('exact prestige availability blocks both previous and future New Beginning stages', () => {
  const task = {
    id: 'nb',
    taskRequirements: [],
    traderRequirements: [],
    requiredPrestige: 1,
    exactPrestige: 1,
  };
  const profile = { tasks: {}, traders: {} };
  assert.equal(evaluateAvailability(task, profile).state, 'unknown');
  assert.equal(evaluateAvailability(task, { ...profile, prestige: 0 }).state, 'blocked');
  assert.equal(evaluateAvailability(task, { ...profile, prestige: 1 }).state, 'eligible');
  assert.equal(evaluateAvailability(task, { ...profile, prestige: 2 }).state, 'blocked');
});
test('missing New Beginning supplements preserve objective IDs and never leak into PvE', () => {
  const addition = {
    id: 'new_beginning_prestige_5',
    name: 'New Beginning',
    wikiLink: beginning(5).wikiLink,
    trader: { id: 'traderA' },
    requiredPrestige: { prestigeLevel: 4 },
    objectives: [
      {
        id: 'nb-five-item',
        description: 'Give item',
        type: 'giveItem',
        count: 1,
        foundInRaid: true,
        items: [{ id: 'itemA' }],
      },
    ],
  };
  const overlay = signedOverlay({ tasksAdd: { [addition.id]: addition } });
  const snapshot = supplementProgression(normalizeMode('regular', makeFeeds()), overlay);
  const task = snapshot.tasks.find((task) => task.id === addition.id);
  assert.deepEqual(task.objectives[0].items, ['itemA']);
  assert.equal(task.objectives[0].id, 'nb-five-item');
  assert.equal(
    evaluateAvailability(task, { prestige: 4, tasks: {}, traders: {} }).state,
    'unknown',
  );
  assert.equal(
    supplementProgression(normalizeMode('pve', makeFeeds()), overlay).tasks.some(
      (task) => task.id === addition.id,
    ),
    false,
  );
  assert.equal(
    supplementProgression(snapshot, overlay).tasks.filter((task) => task.id === addition.id).length,
    1,
  );
  const bad = signedOverlay({
    tasksAdd: {
      [addition.id]: {
        ...addition,
        objectives: [{ ...addition.objectives[0], items: [{ id: 'missing' }] }],
      },
    },
  });
  assert.throws(
    () => supplementProgression(normalizeMode('regular', makeFeeds()), bad),
    /Missing prestige item/,
  );
});
