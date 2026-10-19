import test from 'node:test';
import assert from 'node:assert/strict';
import { taskMapIds } from '../src/domain/maps.ts';
import { createProfile } from '../src/domain/profiles.ts';

test('map planning combines task and required objective maps and deduplicates variants', () => {
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
