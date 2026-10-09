import test from 'node:test';
import assert from 'node:assert/strict';
import { traderUnlocked, effectiveTraderProgress, visibleTrader } from '../src/domain/traders.ts';

const gates = [
  ['5c0647fdd443bc2504c2d371', '5d2495a886f77425cd51e403'],
  ['6617beeaa9cfa777ca915b7c', '66058cb22cee99303f1ba067'],
];
test('Jaeger and Ref unlock only on completion, undo relocks, and legacy flags cannot bypass gates', () => {
  for (const [traderId, taskId] of gates) {
    const trader = {
      id: traderId,
      levels: [{ level: 1, requiredPlayerLevel: 1, requiredReputation: 0 }],
    };
    for (const state of ['unstarted', 'active', 'failed', 'complete', 'unstarted']) {
      const profile = {
        level: 20,
        tasks: { [taskId]: state },
        traders: { [traderId]: { unlocked: true, level: 4, reputation: 0 } },
      };
      assert.equal(traderUnlocked(traderId, profile), state === 'complete');
      assert.equal(effectiveTraderProgress(trader, profile).level, state === 'complete' ? 4 : 0);
    }
    assert.equal(
      traderUnlocked(traderId, {
        tasks: { [taskId]: 'complete' },
        traders: { [traderId]: { unlocked: false } },
      }),
      true,
    );
  }
});
test('ordinary traders derive LL without manual unlock state; missing inputs remain unknown', () => {
  const trader = {
    id: 'prapor',
    levels: [
      { level: 1, requiredPlayerLevel: 1, requiredReputation: 0 },
      { level: 2, requiredPlayerLevel: 15, requiredReputation: 0.2 },
    ],
  };
  const profile = {
    level: 20,
    tasks: {},
    traders: { prapor: { reputation: 0.2, unlocked: false } },
  };
  assert.equal(effectiveTraderProgress(trader, profile).level, 2);
  assert.equal(effectiveTraderProgress(trader, { ...profile, traders: {} }).level, undefined);
  assert.equal(effectiveTraderProgress(trader, { ...profile, traders: {} }).unlocked, true);
});
test('five story traders are hidden while supported traders remain visible', () => {
  for (const id of [
    '688246518448b05efd61d461',
    '688246958448b05efd61d462',
    '68fe15910f29ba3fdbba9d54',
    '68fe15990f29ba3fdbba9d55',
    '69e0d6cc77b63940375b9173',
  ])
    assert.equal(visibleTrader({ id }), false);
  for (const [id] of gates) assert.equal(visibleTrader({ id }), true);
});
