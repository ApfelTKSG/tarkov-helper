import type { GameTask } from './game';
import type { TaskState } from './progression';

/** Within each LL column: lower PMC requirement, then fewer direct prerequisite gates. */
export function compareGraphTasks(a: GameTask, b: GameTask): number {
  return (
    (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0) ||
    a.taskRequirements.length - b.taskRequirements.length ||
    a.id.localeCompare(b.id)
  );
}

export function prerequisiteProgress(task: GameTask, states: Record<string, TaskState>) {
  return {
    met: task.taskRequirements.filter((req) => req.status.includes(states[req.task] ?? 'unstarted'))
      .length,
    total: task.taskRequirements.length,
  };
}
