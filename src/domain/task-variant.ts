import type { GameTask } from './game';

/** Keep distinct IDs and progress, but explain which prerequisite route each name belongs to. */
export function taskVariantLabel(task: GameTask, tasks: GameTask[], depth = 0): string | undefined {
  const siblings = tasks.filter(
    (other) => other.trader === task.trader && other.englishName === task.englishName,
  );
  if (siblings.length < 2) return undefined;
  if (depth >= 3) return `別条件 · ${task.id.slice(-6)}`;
  const unique = task.taskRequirements.filter(
    (req) => !siblings.every((other) => other.taskRequirements.some((r) => r.task === req.task)),
  );
  const names = unique.map((req) => {
    const previous = tasks.find((other) => other.id === req.task);
    if (!previous) return req.task;
    const route = depth < 3 ? taskVariantLabel(previous, tasks, depth + 1) : undefined;
    return route ? `${previous.name}（${route}）` : previous.name;
  });
  if (names.length) return `${names.join(' / ')} 経由`;
  if (task.factionName && task.factionName !== 'Any') return task.factionName;
  return `別条件 · ${task.id.slice(-6)}`;
}
