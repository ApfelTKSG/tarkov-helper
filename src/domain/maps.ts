import type { GameTask } from './game';
import type { Profile } from './profiles';
import { objectiveRemaining } from './task-view.ts';

const hiddenMaps = new Set([
  '59fc81d786f774390775787e', // Night Factory
  '65b8d6f5cdde2479cb2a3125', // Ground Zero 21+
  '65cc8f81a9aac3e77d0cfd3e', // Terminal
  '68236e8153654e8c1200798a', // Ground Zero Tutorial
  '6a294a5b5eb5f9a1700417b7', // The Lab (Dark)
]);
export const visibleMap = (map: { id: string }) => !hiddenMaps.has(map.id);
export function taskMapIds(task: GameTask, profile?: Profile): string[] {
  const objectives = task.objectives.filter((o) => !o.optional);
  const remaining = profile
    ? objectives.filter((o) => objectiveRemaining(task, o.id, profile) > 0)
    : objectives;
  const ids = remaining.flatMap((o) => (o.maps?.length ? o.maps : task.map ? [task.map] : []));
  if (!profile && task.map) ids.push(task.map);
  if (!objectives.length && task.map) ids.push(task.map);
  return [...new Set(ids.filter((id) => !hiddenMaps.has(id)))];
}
