import test from 'node:test';
import assert from 'node:assert/strict';
import { taskMapIds, visibleMap } from '../src/domain/maps.ts';
import { createProfile } from '../src/domain/profiles.ts';

test('map planning combines task and required objective maps and removes excluded maps', () => {
  const task = {
    id: 't',
    map: 'woods',
    objectives: [
      { id: 'a', maps: ['customs', 'customs'] },
      { id: 'b', maps: ['59fc81d786f774390775787e', '55f2d3fd4bdc2d5f408b4567'] },
      { id: 'optional', optional: true, maps: ['shoreline'] },
    ],
  };
  assert.deepEqual(taskMapIds(task), ['customs', '55f2d3fd4bdc2d5f408b4567', 'woods']);
});

test('excluded maps are neither selectable nor converted into regular maps', () => {
  const ids = [
    '59fc81d786f774390775787e',
    '65b8d6f5cdde2479cb2a3125',
    '65cc8f81a9aac3e77d0cfd3e',
    '68236e8153654e8c1200798a',
    '6a294a5b5eb5f9a1700417b7',
  ];
  for (const id of ids) {
    assert.equal(visibleMap({ id }), false);
    assert.deepEqual(taskMapIds({ id: 't', map: id, objectives: [{ id: 'o', maps: [id] }] }), []);
  }
  assert.equal(visibleMap({ id: '55f2d3fd4bdc2d5f408b4567' }), true);
});

test('raid planning removes completed objectives and uses task map for unspecified objectives', () => {
  const profile = createProfile('regular', null);
  profile.objectiveCounts['t:customs'] = 2;
  const task = {
    id: 't',
    map: 'woods',
    objectives: [
      { id: 'customs', count: 2, maps: ['customs'] },
      { id: 'woods', count: 1 },
      { id: 'optional', optional: true, maps: ['shoreline'] },
    ],
  };
  assert.deepEqual(taskMapIds(task, profile), ['woods']);
  profile.objectiveCounts['t:woods'] = 1;
  assert.deepEqual(taskMapIds(task, profile), []);
  assert.deepEqual(taskMapIds({ id: 'x', objectives: [] }), []);
  assert.deepEqual(taskMapIds({ id: 'x', map: 'woods', objectives: [] }, profile), ['woods']);
});
