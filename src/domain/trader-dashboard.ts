import type { GameTask, GameTrader } from './game';
import type { Availability, ProgressProfile } from './progression';
import { effectiveTraderProgress, traderUnlocked } from './traders.ts';
import { taskLoyaltyColumn } from './task-columns.ts';

const rounded = (value: number) => Math.round(value * 1e8) / 1e8;
export function standingReward(task: GameTask, traderId: string): number {
  return rounded(
    (task.finishRewards?.traderStanding ?? [])
      .filter((reward) => reward.trader === traderId)
      .reduce((sum, reward) => sum + reward.standing, 0),
  );
}

export function isActionable(task: GameTask, profile: ProgressProfile, result: Availability) {
  const state = profile.tasks[task.id];
  return (
    state !== 'complete' &&
    state !== 'failed' &&
    (state === 'active' || (traderUnlocked(task.trader, profile) && result.state === 'eligible'))
  );
}

/** A minimum count from known, currently available rewards; not a promise about unlocks. */
export function loyaltyGoal(
  trader: GameTrader,
  profile: ProgressProfile,
  availableTasks: GameTask[],
  requestedLevel?: number,
) {
  const current = effectiveTraderProgress(trader, profile);
  const levels = [...trader.levels].sort((a, b) => a.level - b.level);
  const target =
    requestedLevel === undefined
      ? levels.find((level) => level.level > (current.level ?? 1))
      : levels.find((level) => level.level === requestedLevel);
  const reputationGap =
    target && current.reputation !== undefined
      ? rounded(Math.max(0, target.requiredReputation - current.reputation))
      : undefined;
  const playerLevelGap =
    target && profile.level !== undefined
      ? Math.max(0, target.requiredPlayerLevel - profile.level)
      : undefined;
  const candidates = [...new Map(availableTasks.map((task) => [task.id, task])).values()]
    .filter(
      (task) =>
        task.trader === trader.id &&
        !['complete', 'failed'].includes(profile.tasks[task.id] ?? '') &&
        standingReward(task, trader.id) > 0,
    )
    .sort(
      (a, b) =>
        standingReward(b, trader.id) - standingReward(a, trader.id) || a.id.localeCompare(b.id),
    );
  const plan: GameTask[] = [];
  let sum = 0;
  for (const task of candidates) {
    if (reputationGap === undefined || sum >= reputationGap) break;
    plan.push(task);
    sum = rounded(sum + standingReward(task, trader.id));
  }
  return {
    current,
    target,
    reputationGap,
    playerLevelGap,
    plan,
    minimumTasks: reputationGap !== undefined && sum >= reputationGap ? plan.length : undefined,
    availableReputation: rounded(
      candidates.reduce((total, task) => total + standingReward(task, trader.id), 0),
    ),
  };
}

export interface UnlockMilestone {
  key: string;
  completed: number;
  required: number;
  remaining: number;
  taskIds: string[];
  targets: { task: GameTask; otherConditions: boolean }[];
}

/** Label the counted cohort, never the LL of the quest it unlocks. */
export function countCohortLabel(taskIds: string[], allTasks: GameTask[]): string {
  const byId = new Map(allTasks.map((task) => [task.id, task]));
  const cohort = taskIds.map((id) => byId.get(id));
  if (!cohort.length || cohort.some((task) => !task)) return '対象タスク';
  const traders = new Set(cohort.map((task) => task!.trader));
  const levels = new Set(cohort.map((task) => taskLoyaltyColumn(task!, allTasks)));
  const level = [...levels][0];
  return traders.size === 1 && levels.size === 1 && level > 0 ? `LL${level}のタスク` : '対象タスク';
}

/** Group identical verified count gates; overlapping gates are never added together. */
export function unlockMilestones(
  tasks: GameTask[],
  profile: ProgressProfile,
  availability: (task: GameTask) => Availability,
): UnlockMilestone[] {
  const groups = new Map<string, UnlockMilestone>();
  for (const task of tasks) {
    const result = availability(task);
    if (
      ['complete', 'failed', 'active'].includes(profile.tasks[task.id] ?? '') ||
      result.state === 'eligible'
    )
      continue;
    for (const condition of result.conditions) {
      const counter = condition.counter;
      if (!counter?.derived || condition.state !== 'unmet') continue;
      const requirement = task.otherRequirements?.find(
        (req) => `${task.id}:${req.id}` === condition.reference,
      );
      if (!requirement || !['>=', '>'].includes(String(requirement.compareMethod))) continue;
      const required =
        requirement.compareMethod === '>'
          ? Math.floor(counter.required) + 1
          : Math.ceil(counter.required);
      const remaining = Math.max(0, required - counter.completed);
      if (!remaining) continue;
      const taskIds = [...new Set(counter.taskIds)].sort();
      const key = JSON.stringify([taskIds, required]);
      const group = groups.get(key) ?? {
        key,
        completed: counter.completed,
        required,
        remaining,
        taskIds,
        targets: [],
      };
      group.targets.push({
        task,
        otherConditions:
          !traderUnlocked(task.trader, profile) ||
          result.conditions.some((other) => other !== condition && other.state !== 'met'),
      });
      groups.set(key, group);
    }
  }
  return [...groups.values()].sort(
    (a, b) => a.remaining - b.remaining || a.required - b.required || a.key.localeCompare(b.key),
  );
}

export function taskUnlockImpact(taskId: string, milestones: UnlockMilestone[]) {
  const relevant = milestones.filter((milestone) => milestone.taskIds.includes(taskId));
  const targetIds = new Set(
    relevant.flatMap((milestone) => milestone.targets.map(({ task }) => task.id)),
  );
  return {
    count: targetIds.size,
    nearest: relevant.length
      ? Math.min(...relevant.map((milestone) => milestone.remaining))
      : undefined,
  };
}
