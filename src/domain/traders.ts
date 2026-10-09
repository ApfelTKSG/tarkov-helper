import type { GameTrader } from './game';
import type { ProgressProfile } from './progression';
import { deriveLoyaltyLevel } from './progression.ts';

const hiddenTraders = new Set([
  '688246518448b05efd61d461', // Mr. Kerman
  '688246958448b05efd61d462', // Voevoda
  '68fe15910f29ba3fdbba9d54', // Taran
  '68fe15990f29ba3fdbba9d55', // Radio station
  '69e0d6cc77b63940375b9173', // Survivor
]);
const unlockTasks: Record<string, string> = {
  '5c0647fdd443bc2504c2d371': '5d2495a886f77425cd51e403', // Introduction
  '6617beeaa9cfa777ca915b7c': '66058cb22cee99303f1ba067', // Easy Money - Part 1
};

export function visibleTrader(trader: GameTrader): boolean {
  return !hiddenTraders.has(trader.id);
}

export function traderUnlocked(traderId: string, profile: ProgressProfile): boolean {
  const task = unlockTasks[traderId];
  return !task || profile.tasks[task] === 'complete';
}

/** Saved manual unlock flags are obsolete; task completion is the source of truth. */
export function effectiveTraderProgress(trader: GameTrader, profile: ProgressProfile) {
  const progress = profile.traders[trader.id] ?? {};
  const unlocked = traderUnlocked(trader.id, profile);
  return {
    ...progress,
    unlocked,
    level: unlocked
      ? (progress.level ??
        deriveLoyaltyLevel(profile.level, progress.reputation, trader.levels, true))
      : 0,
  };
}
