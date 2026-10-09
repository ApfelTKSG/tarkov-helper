import type { GameTask } from './game';
import type { Profile } from './profiles';
import type { TaskState } from './progression';

export function reputationRewards(task: GameTask, state: TaskState): Record<string, number> {
  const rewards =
    state === 'complete'
      ? task.finishRewards
      : state === 'failed'
        ? task.failureOutcome
        : undefined;
  const deltas: Record<string, number> = {};
  for (const { trader, standing } of rewards?.traderStanding ?? []) {
    if (!['__proto__', 'constructor', 'prototype'].includes(trader) && Number.isFinite(standing))
      deltas[trader] = round((deltas[trader] ?? 0) + standing);
  }
  return deltas;
}
const round = (value: number) => Math.round(value * 1e8) / 1e8;

export function toggleTaskCompletion(profile: Profile, task: GameTask): Profile {
  return changeTaskState(
    profile,
    task,
    profile.tasks[task.id] === 'complete'
      ? (profile.taskStateBeforeCompletion?.[task.id] ?? 'unstarted')
      : 'complete',
  );
}

/** Apply only state transitions, undoing the exact original amounts, even after API updates. */
export function changeTaskState(profile: Profile, task: GameTask, state: TaskState): Profile {
  if ((profile.tasks[task.id] ?? 'unstarted') === state)
    return state === 'complete' && profile.favorites.includes(task.id)
      ? { ...profile, favorites: profile.favorites.filter((id) => id !== task.id) }
      : profile;
  const previous = profile.taskReputation?.[task.id] ?? {};
  const next = reputationRewards(task, state);
  const traders = { ...profile.traders };
  for (const id of new Set([...Object.keys(previous), ...Object.keys(next)])) {
    const delta = round((next[id] ?? 0) - (previous[id] ?? 0));
    if (delta !== 0)
      traders[id] = { ...traders[id], reputation: round((traders[id]?.reputation ?? 0) + delta) };
  }
  const completedAt = { ...profile.completedAt };
  const taskStateBeforeCompletion = { ...profile.taskStateBeforeCompletion };
  if (state === 'complete')
    taskStateBeforeCompletion[task.id] = (profile.tasks[task.id] ?? 'unstarted') as
      'unstarted' | 'active' | 'failed';
  else delete taskStateBeforeCompletion[task.id];
  if (state === 'complete') completedAt[task.id] = Date.now();
  else delete completedAt[task.id];
  return {
    ...profile,
    tasks: { ...profile.tasks, [task.id]: state },
    favorites:
      state === 'complete' || profile.tasks[task.id] === 'complete'
        ? profile.favorites.filter((id) => id !== task.id)
        : profile.favorites,
    traders,
    completedAt,
    taskStateBeforeCompletion,
    taskReputation: { ...profile.taskReputation, [task.id]: next },
  };
}
