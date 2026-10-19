import type { GameSnapshot, GameTask } from './game';
import type { Profile } from './profiles';
import type { Availability } from './progression';
import type { ItemDemand } from './items';
import { taskLock, compareLockRank } from './task-groups.ts';
import { taskLoyaltyColumn } from './task-columns.ts';
import { isActionable } from './trader-dashboard.ts';

/** A display heuristic, never an eligibility decision: near = <=5 levels, 3 completions,
 * one unfinished prerequisite and one LL. Every known gap must fit those bounds. */
export function firTaskPriority(
  task: GameTask,
  profile: Profile,
  snapshot: GameSnapshot,
  result: Availability,
) {
  const lock = taskLock(task, profile, result, snapshot);
  const gaps = lock?.shortages;
  const phase = isActionable(task, profile, result)
    ? 0
    : lock?.uncertain || lock?.group === 'unknown'
      ? 3
      : gaps &&
          gaps.playerLevels <= 5 &&
          gaps.completions <= 3 &&
          gaps.tasks <= 1 &&
          gaps.loyaltyLevels <= 1
        ? 1
        : 2;
  return {
    favorite: profile.favorites.includes(task.id),
    rank: [
      phase,
      taskLoyaltyColumn(task, snapshot.tasks) || Infinity,
      task.minPlayerLevel ?? 0,
      gaps?.completions ?? 0,
      gaps?.tasks ?? 0,
      gaps?.loyaltyLevels ?? 0,
    ],
  };
}

export function firItemPriority(
  demands: ItemDemand[],
  priorities: Map<string, ReturnType<typeof firTaskPriority>>,
  profile: Profile,
  secured: boolean,
  collectorId: string,
) {
  // An already secured early-game objective must not pull a late-game demand upward.
  const remaining = demands.filter(
    (demand) =>
      (profile.objectiveCounts[`${demand.taskId}:${demand.objectiveId}`] ?? 0) < demand.count,
  );
  const favorite = !secured && remaining.some((demand) => priorities.get(demand.taskId)?.favorite);
  const collectorOnly =
    remaining.length > 0 && remaining.every((demand) => demand.taskId === collectorId);
  const rank = remaining
    .map((demand) => priorities.get(demand.taskId)?.rank ?? [3, Infinity])
    .sort(compareLockRank)[0] ?? [3, Infinity];
  return {
    favorite,
    rank: [
      Number(secured),
      Number(!favorite),
      Number(collectorOnly),
      ...(collectorOnly ? [] : rank),
    ],
  };
}
