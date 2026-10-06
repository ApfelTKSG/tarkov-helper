import type { GameTask } from './game';
import { compareNumber } from './progression.ts';

export const loyaltyColumns = [
  { key: 1, label: 'LL1' },
  { key: 2, label: 'LL2' },
  { key: 3, label: 'LL3' },
  { key: 4, label: 'LL4' },
  { key: 0, label: 'LL要確認' },
];

/** Only the task's own trader determines its column; other gates remain in task details. */
export function taskLoyaltyColumn(task: GameTask): number {
  const gates = task.traderRequirements.filter(
    (r) => r.trader === task.trader && r.requirementType === 'level',
  );
  if (!gates.length) return task.supplementLoyaltyLevel ?? (task.otherRequirements?.length ? 0 : 1);
  for (let level = 1; level <= 4; level++)
    if (gates.every((r) => compareNumber(level, r.compareMethod, r.value) === true)) return level;
  return 0;
}
