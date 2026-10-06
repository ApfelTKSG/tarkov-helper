import type { GameTask } from './game';
import { taskLoyaltyColumn } from './task-columns.ts';

export interface TaskFolder {
  id: string;
  tasks: GameTask[];
  level: number;
  levels: number[];
}

/** Detect each trader's lines against the full catalogue, independent of display filters. */
export function taskFolders(allTasks: GameTask[]): TaskFolder[] {
  const byId = new Map(allTasks.map((task) => [task.id, task]));
  const outgoing = new Map<string, Set<string>>();
  for (const task of allTasks) {
    for (const req of task.taskRequirements) {
      if (byId.get(req.task)?.trader !== task.trader) continue;
      const next = outgoing.get(req.task) ?? new Set<string>();
      next.add(task.id);
      outgoing.set(req.task, next);
    }
  }
  const levels = new Map(allTasks.map((task) => [task.id, taskLoyaltyColumn(task, allTasks)]));
  const predecessors = (task: GameTask) =>
    task.taskRequirements.filter((req) => byId.get(req.task)?.trader === task.trader);
  const eligible = (task: GameTask) =>
    predecessors(task).length <= 1 &&
    (outgoing.get(task.id)?.size ?? 0) <= 1 &&
    task.taskRequirements.every(
      (req) =>
        byId.has(req.task) &&
        req.status.length > 0 &&
        req.status.every((status) => status === 'active' || status === 'complete'),
    );
  const follows = (previous: GameTask, next: GameTask) =>
    eligible(previous) && eligible(next) && previous.trader === next.trader;
  const visited = new Set<string>();
  const folders: TaskFolder[] = [];
  for (const task of allTasks) {
    if (!eligible(task) || visited.has(task.id)) continue;
    const previousId = predecessors(task)[0]?.task;
    const previous = previousId ? byId.get(previousId) : undefined;
    if (previous && follows(previous, task)) continue;
    const line: GameTask[] = [];
    let current: GameTask | undefined = task;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      line.push(current);
      const nextId: string | undefined = outgoing.get(current.id)?.values().next().value;
      const next: GameTask | undefined = nextId ? byId.get(nextId) : undefined;
      current = next && follows(current, next) ? next : undefined;
    }
    if (line.length >= 3)
      folders.push({
        id: `task-folder-${task.id}`,
        tasks: line,
        level: levels.get(task.id)!,
        levels: [...new Set(line.map((t) => levels.get(t.id)!))].sort((a, b) => a - b),
      });
  }
  // Cycles have no start and are deliberately left as individual tasks.
  return folders;
}

export function visibleTaskFolders(
  folders: TaskFolder[],
  tasks: GameTask[],
  expanded: ReadonlySet<string>,
  revealMatches: boolean,
  selectedId?: string,
) {
  const ids = new Set(tasks.map((task) => task.id));
  return folders
    .filter((folder) => folder.tasks.every((task) => ids.has(task.id)))
    .map((folder) => ({
      ...folder,
      expanded:
        revealMatches || expanded.has(folder.id) || folder.tasks.some((t) => t.id === selectedId),
    }));
}
