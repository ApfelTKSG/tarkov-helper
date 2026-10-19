import test from 'node:test';
import assert from 'node:assert/strict';
import { playerLevelBadge } from '../src/domain/player-level.ts';
import { createProfile } from '../src/domain/profiles.ts';

test('new profiles start at level one in every game mode', () => {
  for (const mode of ['regular', 'pve', 'pvp-season'])
    assert.equal(createProfile(mode, null).level, 1);
});
test('level badges follow API group boundaries and prefer snapshot metadata', () => {
  for (const [level, group] of [
    [1, 1],
    [4, 1],
    [5, 2],
    [9, 2],
    [10, 3],
    [74, 15],
    [75, 16],
    [79, 16],
  ])
    assert.equal(
      playerLevelBadge(level),
      `https://assets.tarkov.dev/player-level-group-${group}.png`,
    );
  assert.equal(
    playerLevelBadge(5, {
      playerLevels: [{ level: 5, levelBadgeImageLink: 'https://example.com/new-badge.png' }],
    }),
    'https://example.com/new-badge.png',
  );
  assert.equal(playerLevelBadge(0), undefined);
  assert.equal(playerLevelBadge(1.5), undefined);
});
