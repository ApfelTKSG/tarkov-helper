import test from 'node:test';
import assert from 'node:assert/strict';
import { raidPackingList } from '../src/domain/raid-packing.ts';
import { createProfile } from '../src/domain/profiles.ts';

test('packing candidates follow the selected map, remaining objectives and distinct reusable keys', () => {
  const p = createProfile('regular', null);
  p.objectiveCounts['task:mark'] = 1;
  p.objectiveCounts['task:done'] = 1;
  const task = {
    id: 'task',
    map: 'woods',
    objectives: [
      {
        id: 'mark',
        count: 3,
        markerItem: 'marker',
        requiredKeys: [['key', 'alternative'], ['key']],
      },
      { id: 'second', count: 2, maps: ['woods'], markerItem: 'marker' },
      {
        id: 'customs',
        count: 1,
        maps: ['customs'],
        markerItem: 'other',
        requiredKeys: [['customs-key']],
      },
      { id: 'done', count: 1, requiredKeys: [['done-key']] },
      { id: 'optional', count: 1, optional: true, markerItem: 'optional-marker' },
    ],
    neededKeys: [
      { map: 'woods', keys: ['key', 'task-key'] },
      { map: 'customs', keys: ['customs-key'] },
    ],
  };
  assert.deepEqual(raidPackingList([task], p, 'woods'), {
    keys: ['key', 'alternative', 'task-key'],
    markers: [{ item: 'marker', count: 4 }],
  });
  assert.deepEqual(raidPackingList([task], p, 'customs'), {
    keys: ['customs-key'],
    markers: [{ item: 'other', count: 1 }],
  });
  p.tasks.task = 'complete';
  assert.deepEqual(raidPackingList([task], p, 'woods'), { keys: [], markers: [] });
});

test('unspecified-map packing is separate from hidden maps and map-specific task keys', () => {
  const p = createProfile('regular', null);
  const task = {
    id: 'task',
    objectives: [
      { id: 'unknown', count: 1, requiredKeys: [['unknown-key']] },
      { id: 'hidden', count: 1, maps: ['59fc81d786f774390775787e'], markerItem: 'hidden-marker' },
    ],
    neededKeys: [{ map: 'woods', keys: ['woods-key'] }],
  };
  assert.deepEqual(raidPackingList([task], p, 'none'), { keys: ['unknown-key'], markers: [] });
  assert.deepEqual(raidPackingList([task], p, 'woods'), { keys: [], markers: [] });
  assert.equal(raidPackingList([task], p).markers.length, 0);
});
