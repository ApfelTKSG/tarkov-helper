import type { GameSnapshot, GameTask } from './game';
import type { Profile } from './profiles';

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
