import type { GameTask } from './game';
import type { Profile } from './profiles';
import { objectiveRemaining } from './task-view.ts';

const aliases: Record<string, string> = {
  '59fc81d786f774390775787e': '55f2d3fd4bdc2d5f408b4567', // Night Factory
  '65b8d6f5cdde2479cb2a3125': '653e6760052c01c1c805532f', // Ground Zero 21+
  '6a294a5b5eb5f9a1700417b7': '5b0fc42d86f7744a585f9105', // The Lab (Dark)
};
export function taskMapIds(task: GameTask, profile?: Profile): string[] {
  const objectives = task.objectives.filter((o) => !o.optional);
  const remaining = profile
    ? objectives.filter((o) => objectiveRemaining(task, o.id, profile) > 0)
    : objectives;
  const ids = remaining.flatMap((o) => (o.maps?.length ? o.maps : task.map ? [task.map] : []));
  if (!profile && task.map) ids.push(task.map);
  if (!objectives.length && task.map) ids.push(task.map);
  return [...new Set(ids.map((id) => aliases[id] ?? id))];
}
