import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMode, translateEnvelope, diffSnapshots } from '../src/data/normalize.mjs';
import { makeFeeds } from './fixtures.mjs';

test('translations fall back to English, preserving IDs, casing, and raw candidates', () => {
  const snapshot = normalizeMode('regular', makeFeeds());
  assert.equal(snapshot.tasks[0].name, '最初');
  assert.equal(snapshot.tasks[1].name, 'Second');
  assert.deepEqual(snapshot.tasks[0].objectives[0].items, ['itemA', 'itemB']);
  assert.equal(snapshot.tasks[0].objectives[0].count, 3);
  assert.equal(snapshot.tasks[1].otherRequirements[0].variableId, 'opaque');
  assert.equal(snapshot.items.unused, undefined);
  const envelope = {
    data: { name: 'Front_plate', other: 'front_plate', id: 'Front_plate' },
    translations: ['$.data.name', '$.data.other'],
  };
  assert.deepEqual(translateEnvelope(envelope, { Front_plate: 'A', front_plate: 'B' }).data, {
    name: 'A',
    other: 'B',
    id: 'Front_plate',
  });
});

test('volatile trader reset times, source timestamps, key order and prices do not change revision', () => {
  const first = normalizeMode('regular', makeFeeds());
  const feeds = makeFeeds();
  feeds.traders.body.data.traderA.resetTime = 'later';
  feeds.items.body.data.items.itemA.avg24hPrice = 999;
  feeds.tasks.fetchedAt = 'later';
  feeds.tasks.body.data.tasks = Object.fromEntries(
    Object.entries(feeds.tasks.body.data.tasks).reverse(),
  );
  const second = normalizeMode('regular', feeds);
  assert.equal(second.revision, first.revision);
  assert.deepEqual(diffSnapshots(first, second).changed, []);
});

test('requirements and translations are semantic changes; mode is part of revision', () => {
  const first = normalizeMode('regular', makeFeeds());
  const feeds = makeFeeds();
  feeds.tasks.body.data.tasks.taskB.traderRequirements[0].value = 3;
  const second = normalizeMode('regular', feeds);
  assert.notEqual(first.revision, second.revision);
  assert.deepEqual(diffSnapshots(first, second).changed, ['taskB']);
  assert.notEqual(first.revision, normalizeMode('pve', makeFeeds()).revision);
});

test('missing prerequisite and unknown condition type fail validation', () => {
  const feeds = makeFeeds();
  feeds.tasks.body.data.tasks.taskB.taskRequirements[0].task = 'missing';
  assert.throws(() => normalizeMode('regular', feeds), /Missing prerequisite/);
  const newer = makeFeeds();
  newer.tasks.body.data.tasks.taskB.otherRequirements[0].type = 'newGate';
  assert.throws(() => normalizeMode('regular', newer), /Unsupported other requirement/);
});

test('JSONPath unions and recursive body parts translate without changing references', () => {
  const base = {
    data: {
      objectives: [
        {
          nested: { bodyParts: ['body'] },
          healthEffect: { effects: ['effect'] },
          playerHealthEffect: { effects: ['effect'] },
          item: 'body',
        },
      ],
    },
    translations: [
      '$.data.objectives[*]..bodyParts[*]',
      "$.data.objectives[*]['healthEffect','playerHealthEffect'].effects[*]",
    ],
  };
  const result = translateEnvelope(base, { body: '胴体', effect: '効果' });
  assert.equal(result.data.objectives[0].nested.bodyParts[0], '胴体');
  assert.equal(result.data.objectives[0].healthEffect.effects[0], '効果');
  assert.equal(result.data.objectives[0].playerHealthEffect.effects[0], '効果');
  assert.equal(result.data.objectives[0].item, 'body');
  assert.equal(base.data.objectives[0].nested.bodyParts[0], 'body');
});

test('nullable count is preserved for non-count objectives', () => {
  const feeds = makeFeeds();
  feeds.tasks.body.data.tasks.taskA.objectives.push({
    id: 'stateGate',
    type: 'taskStatus',
    description: 'state',
    count: null,
  });
  assert.equal(normalizeMode('regular', feeds).tasks[0].objectives[1].count, null);
});
