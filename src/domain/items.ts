import type { GameTask } from './game';
import type { Profile } from './profiles';
import { objectiveRemaining } from './task-view.ts';

export interface ItemDemand {
  taskId: string;
  taskName: string;
  objectiveId: string;
  count: number;
}
export function remainingFirItems(tasks: GameTask[], profile: Profile) {
  const singles = new Map<string, { itemId: string; count: number; demands: ItemDemand[] }>();
  const alternatives: { candidates: string[]; demand: ItemDemand }[] = [];
  for (const task of tasks)
    for (const objective of task.objectives) {
      if (objective.type !== 'giveItem' || !objective.foundInRaid || objective.optional) continue;
      const count = objectiveRemaining(task, objective.id, profile);
      if (!count) continue;
      const candidates = [...new Set(objective.item ? [objective.item] : (objective.items ?? []))];
      const demand = { taskId: task.id, taskName: task.name, objectiveId: objective.id, count };
      if (candidates.length === 1) {
        const entry = singles.get(candidates[0]) ?? {
          itemId: candidates[0],
          count: 0,
          demands: [],
        };
        entry.count += count;
        entry.demands.push(demand);
        singles.set(entry.itemId, entry);
      } else if (candidates.length > 1) alternatives.push({ candidates, demand });
    }
  return { singles: [...singles.values()], alternatives };
}
