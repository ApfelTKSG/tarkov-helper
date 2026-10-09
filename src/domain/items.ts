import type { GameTask } from './game';
import type { Profile } from './profiles';
import { objectiveRemaining } from './task-view.ts';

export interface ItemDemand {
  taskId: string;
  taskName: string;
  objectiveId: string;
  count: number;
}

/** Change the shared total without reallocating counts already entered for other tasks. */
export function setFirGroupCount(profile: Profile, demands: ItemDemand[], total: number): Profile {
  const active = demands.filter(
    (demand) => !['complete', 'failed'].includes(profile.tasks[demand.taskId] ?? 'unstarted'),
  );
  const current = active.reduce(
    (sum, demand) =>
      sum +
      Math.min(
        profile.objectiveCounts[`${demand.taskId}:${demand.objectiveId}`] ?? 0,
        demand.count,
      ),
    0,
  );
  const maximum = active.reduce((sum, demand) => sum + demand.count, 0);
  if (!Number.isInteger(total) || total < 0 || total > maximum || total === current) return profile;
  let delta = total - current;
  const objectiveCounts = { ...profile.objectiveCounts };
  for (const demand of delta > 0 ? active : [...active].reverse()) {
    const key = `${demand.taskId}:${demand.objectiveId}`;
    const count = Math.min(objectiveCounts[key] ?? 0, demand.count);
    const change = delta > 0 ? Math.min(delta, demand.count - count) : Math.max(delta, -count);
    if (change) objectiveCounts[key] = count + change;
    delta -= change;
    if (!delta) break;
  }
  return { ...profile, objectiveCounts };
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
