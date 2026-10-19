import type { GameTask } from './game';
import type { Profile } from './profiles';
import { objectiveRemaining } from './task-view.ts';
import { visibleMap } from './maps.ts';

/** Tasks are supplied by the caller's actionable-task scope; search text never changes the kit. */
export function raidPackingList(tasks: GameTask[], profile: Profile, map = '') {
  const keys = new Set<string>();
  const markers = new Map<string, number>();
  for (const task of tasks) {
    let included = false;
    for (const objective of task.objectives) {
      const remaining = objectiveRemaining(task, objective.id, profile);
      if (objective.optional || !remaining) continue;
      const maps = objective.maps?.length ? objective.maps : task.map ? [task.map] : [];
      const visible = maps.filter((id) => visibleMap({ id }));
      if (maps.length && !visible.length) continue;
      if (map && (map === 'none' ? maps.length > 0 : !visible.includes(map))) continue;
      included = true;
      for (const id of (objective.requiredKeys ?? []).flat()) keys.add(id);
      if (objective.markerItem)
        markers.set(objective.markerItem, (markers.get(objective.markerItem) ?? 0) + remaining);
    }
    if (included) {
      for (const group of task.neededKeys ?? []) {
        if (!visibleMap({ id: group.map }) || (map && group.map !== map)) continue;
        for (const id of group.keys) keys.add(id);
      }
    }
  }
  return { keys: [...keys], markers: [...markers].map(([item, count]) => ({ item, count })) };
}
