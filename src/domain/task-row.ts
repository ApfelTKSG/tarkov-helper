import type { GameTask } from './game';

/** Alternative items share one objective count; find/give pairs are not double-counted. */
export function taskFirEntries(task: GameTask, counts: Record<string, number>) {
  return task.objectives
    .filter(
      (objective) =>
        objective.type === 'giveItem' &&
        objective.foundInRaid &&
        !objective.optional &&
        objective.count !== 0,
    )
    .map((objective) => {
      const maximum =
        typeof objective.count === 'number' &&
        Number.isInteger(objective.count) &&
        objective.count > 0
          ? objective.count
          : undefined;
      const key = `${task.id}:${objective.id}`;
      return {
        id: objective.id,
        key,
        description: objective.description,
        items: [...new Set(objective.item ? [objective.item] : (objective.items ?? []))],
        maximum,
        value: maximum === undefined ? 0 : Math.min(maximum, Math.max(0, counts[key] ?? 0)),
      };
    });
}

export function taskSummary(task: GameTask) {
  return task.objectives
    .filter((objective) => !objective.optional)
    .map((objective) => objective.description)
    .filter(Boolean)
    .join(' / ');
}
