import test from 'node:test';
import assert from 'node:assert/strict';
import { compareNumber, evaluateAvailability, deriveLoyaltyLevel } from '../src/domain/progression.ts';

const task = () => ({ id: 'target', minPlayerLevel: 6, taskRequirements: [{ task: 'before', status: ['failed', 'complete'] }],
  traderRequirements: [{ trader: 'prapor', requirementType: 'level', compareMethod: '>=', value: 2 }, { trader: 'fence', requirementType: 'reputation', compareMethod: '>=', value: 1 }] });
const profile = () => ({ level: 6, tasks: { before: 'failed' }, traders: { prapor: { level: 2 }, fence: { reputation: 1 } } });

test('failed and active prerequisite states are evaluated as declared, never inferred complete', () => {
  assert.equal(evaluateAvailability(task(), profile()).state, 'eligible');
  const active = task(); active.taskRequirements[0].status = ['active'];
  assert.equal(evaluateAvailability(active, profile()).state, 'blocked');
  const state = profile(); state.tasks.before = 'active';
  assert.equal(evaluateAvailability(active, state).state, 'eligible');
});

test('Fence reputation >= 1 is not Fence LL1; absent input is unknown', () => {
  const state = profile(); state.traders.fence = { level: 4 };
  assert.equal(evaluateAvailability(task(), state).state, 'unknown');
  state.traders.fence.reputation = 0.99;
  assert.equal(evaluateAvailability(task(), state).state, 'blocked');
  state.traders.fence.reputation = 1;
  assert.equal(evaluateAvailability(task(), state).state, 'eligible');
});

test('all comparators, negative reputation, and threshold boundaries', () => {
  assert.equal(compareNumber(-0.5, '<=', 0), true);
  for (const [operator, expected] of [['>=', true], ['<=', true], ['>', false], ['<', false], ['=', true]]) assert.equal(compareNumber(1, operator, 1), expected);
  assert.equal(compareNumber(NaN, '>=', 1), undefined);
  assert.equal(compareNumber(1, 'unsupported', 1), undefined);
});

test('opaque conditions are unknown; known unmet gates take precedence; manual availability preserves reasons', () => {
  const definition = task(); definition.otherRequirements = [{ id: 'opaque', type: 'globalVariable' }];
  const state = profile();
  assert.equal(evaluateAvailability(definition, state).state, 'unknown');
  state.level = 5; state.confirmedAvailable = { target: true };
  const result = evaluateAvailability(definition, state);
  assert.equal(result.state, 'blocked');
  assert.equal(result.confirmedInGame, true);
  assert.equal(state.tasks.before, 'failed');
  state.level = 6; state.confirmedRequirements = { 'target:opaque': true };
  assert.equal(evaluateAvailability(definition, state).state, 'eligible');
});

test('loyalty calculation requires an unlocked trader and actual known inputs', () => {
  const levels = [{ level: 1, requiredPlayerLevel: 0, requiredReputation: 0 }, { level: 2, requiredPlayerLevel: 6, requiredReputation: 0.7 }];
  assert.equal(deriveLoyaltyLevel(6, 0.7, levels, true), 2);
  assert.equal(deriveLoyaltyLevel(6, 0.69, levels, true), 1);
  assert.equal(deriveLoyaltyLevel(6, undefined, levels, true), undefined);
  assert.equal(deriveLoyaltyLevel(6, 10, levels, false), 0);
  assert.equal(deriveLoyaltyLevel(6, 10, levels), undefined);
});

test('waiting time uses an explicitly recorded origin, never prerequisite timestamps', () => {
  const definition = { ...task(), availableDelaySecondsMin: 10, availableDelaySecondsMax: 20 };
  const state = { ...profile(), completedAt: { before: 1000 } };
  assert.equal(evaluateAvailability(definition, state, 30_000).state, 'unknown');
  state.delayStartedAt = { target: 1000 };
  assert.equal(evaluateAvailability(definition, state, 5000).state, 'blocked');
  assert.equal(evaluateAvailability(definition, state, 16_000).state, 'unknown');
  assert.equal(evaluateAvailability(definition, state, 21_000).state, 'eligible');
});

test('known locked trader does not satisfy a stored LL value', () => {
  const state = profile(); state.traders.prapor.unlocked = false;
  assert.equal(evaluateAvailability(task(), state).state, 'blocked');
});
