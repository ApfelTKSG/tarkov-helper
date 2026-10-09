import type { GameSnapshot, GameTask } from './game';
import type { Profile } from './profiles';

export function traderTaskLines(allTasks: GameTask[], trader: string) {
  const tasks = allTasks.filter((task) => task.trader === trader);
  const ids = new Set(tasks.map((task) => task.id));
  const connected = new Set<string>();
  for (const task of tasks)
    for (const req of task.taskRequirements)
      if (ids.has(req.task)) {
        connected.add(task.id);
        connected.add(req.task);
      }
  return { connected, depths: taskDepths(tasks) };
}

/** Whole prerequisite-connected lines that contain at least one cross-trader link. */
export function interactingTaskIds(tasks: GameTask[]): Set<string> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const neighbours = new Map<string, Set<string>>();
  const pending: string[] = [];
  for (const task of tasks) {
    for (const req of task.taskRequirements) {
      const previous = byId.get(req.task);
      if (!previous) continue;
      for (const [from, to] of [
        [task.id, previous.id],
        [previous.id, task.id],
      ]) {
        const adjacent = neighbours.get(from) ?? new Set<string>();
        adjacent.add(to);
        neighbours.set(from, adjacent);
      }
      if (previous.trader !== task.trader) pending.push(previous.id, task.id);
    }
  }
  const ids = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const next of neighbours.get(id) ?? []) if (!ids.has(next)) pending.push(next);
  }
  return ids;
}

export function matchesTask(task: GameTask, query: string, snapshot: GameSnapshot): boolean {
  const needle = query.normalize('NFKC').toLocaleLowerCase().trim();
  if (!needle) return true;
  const items = task.objectives
    .flatMap((o) => (o.item ? [o.item] : (o.items ?? [])))
    .map((id) => snapshot.items[id]);
  const text = [
    task.name,
    task.englishName,
    task.id,
    ...task.objectives.map((o) => o.description),
    ...items.flatMap((item) => (item ? [item.name, item.englishName, item.shortName] : [])),
  ]
    .join(' ')
    .normalize('NFKC')
    .toLocaleLowerCase();
  return text.includes(needle);
}
export function taskDepths(tasks: GameTask[]): Map<string, number> {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const depths = new Map<string, number>();
  const visiting = new Set<string>();
  const visit = (id: string): number => {
    if (depths.has(id)) return depths.get(id)!;
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const task = byId.get(id);
    const depth = task
      ? Math.min(
          30,
          Math.max(
            0,
            ...task.taskRequirements
              .filter((req) => byId.has(req.task))
              .map((req) => visit(req.task) + 1),
          ),
        )
      : 0;
    visiting.delete(id);
    depths.set(id, depth);
    return depth;
  };
  for (const task of tasks) visit(task.id);
  return depths;
}
export function ancestorIds(tasks: GameTask[], taskId: string): Set<string> {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const ids = new Set<string>();
  const pending = [taskId];
  while (pending.length) {
    const id = pending.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const req of byId.get(id)?.taskRequirements ?? [])
      if (byId.has(req.task)) pending.push(req.task);
  }
  return ids;
}

export function descendantIds(tasks: GameTask[], taskId: string): Set<string> {
  const outgoing = new Map<string, string[]>();
  for (const task of tasks)
    for (const req of task.taskRequirements)
      outgoing.set(req.task, [...(outgoing.get(req.task) ?? []), task.id]);
  const ids = new Set<string>();
  const pending = [taskId];
  while (pending.length) {
    const id = pending.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    pending.push(...(outgoing.get(id) ?? []));
  }
  return ids;
}
export function objectiveRemaining(task: GameTask, objectiveId: string, profile: Profile): number {
  if (profile.tasks[task.id] === 'complete' || profile.tasks[task.id] === 'failed') return 0;
  const obj = task.objectives.find((o) => o.id === objectiveId);
  return obj
    ? Math.max(0, (obj.count ?? 1) - (profile.objectiveCounts[`${task.id}:${obj.id}`] ?? 0))
    : 0;
}
export function targetTasks(snapshot: GameSnapshot, target: 'kappa' | 'lightkeeper'): GameTask[] {
  // Keep API flags as the source; missing group/Lightkeeper gates remain explicit unknown conditions.
  return snapshot.tasks.filter((task) =>
    target === 'kappa'
      ? task.kappaRequired || task.englishName === 'Collector'
      : task.lightkeeperRequired ||
        snapshot.traders.find((trader) => trader.id === task.trader)?.englishName === 'Lightkeeper',
  );
}
