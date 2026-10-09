import type { GameTask } from './game';
import type { Profile } from './profiles';
import { changeTaskState } from './task-reputation.ts';

export type TaskAvailabilityChoice = 'automatic' | 'available';

/** Unlocking is an acceptance action, never a completion or reputation reward. */
export function setTaskAvailability(
  profile: Profile,
  task: GameTask,
  choice: TaskAvailabilityChoice,
): Profile {
  const next = changeTaskState(profile, task, choice === 'available' ? 'active' : 'unstarted');
  const overrides = { ...next.taskAvailabilityOverrides };
  if (choice === 'automatic') delete overrides[task.id];
  else overrides[task.id] = choice;
  const confirmedAvailable = { ...next.confirmedAvailable };
  delete confirmedAvailable[task.id];
  return { ...next, taskAvailabilityOverrides: overrides, confirmedAvailable };
}
