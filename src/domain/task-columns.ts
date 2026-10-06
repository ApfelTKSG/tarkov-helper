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
function directLoyaltyColumn(task: GameTask, trader = task.trader): number {
  const gates = task.traderRequirements.filter(
    (r) => r.trader === trader && r.requirementType === 'level',
  );
  if (!gates.length)
    return task.trader === trader
      ? (task.supplementLoyaltyLevel ?? (task.otherRequirements?.length ? 0 : 1))
      : 0;
  for (let level = 1; level <= 4; level++)
    if (gates.every((r) => compareNumber(level, r.compareMethod, r.value) === true)) return level;
  return 0;
}

/** Display classification only. A completed prerequisite does not impose its old LL on current eligibility. */
export function taskLoyaltyPlacement(task: GameTask, allTasks: GameTask[]) {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const direct = directLoyaltyColumn(task);
  const visited = new Set<string>();
  const pending = [task];
  const sources: { id: string; level: number }[] = [];
  let level = direct;
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const tier = directLoyaltyColumn(current, task.trader);
    if (current.id !== task.id && tier > direct) sources.push({ id: current.id, level: tier });
    level = Math.max(level, tier);
    for (const req of current.taskRequirements) {
      // active/complete both imply the predecessor was started. A failure alternative
      // does not establish that its start gates were met, so do not inherit through it.
      if (!req.status.length || !req.status.every((s) => s === 'complete' || s === 'active'))
        continue;
      const previous = byId.get(req.task);
      if (previous) pending.push(previous);
    }
  }
  return { level, inheritedFrom: sources.filter((s) => s.level === level) };
}

export function taskLoyaltyColumn(task: GameTask, allTasks: GameTask[] = []): number {
  return taskLoyaltyPlacement(task, allTasks).level;
}
