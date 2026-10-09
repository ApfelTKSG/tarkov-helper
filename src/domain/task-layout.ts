import type { GameTask } from './game';
import { compareGraphTasks } from './task-order.ts';

/** Separate disconnected lines, then order branches by their neighbouring nodes. */
export function layeredTaskRows(tasks: GameTask[], layers: ReadonlyMap<string, number>) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const neighbours = new Map(tasks.map((task) => [task.id, new Set<string>()]));
  const incoming = new Map(tasks.map((task) => [task.id, new Set<string>()]));
  const outgoing = new Map(tasks.map((task) => [task.id, new Set<string>()]));
  for (const task of tasks)
    for (const req of task.taskRequirements)
      if (byId.has(req.task)) {
        neighbours.get(task.id)!.add(req.task);
        neighbours.get(req.task)!.add(task.id);
        incoming.get(task.id)!.add(req.task);
        outgoing.get(req.task)!.add(task.id);
      }
  const rows = new Map<string, number>();
  const visited = new Set<string>();
  let offset = 0;
  for (const start of [...tasks].sort(compareGraphTasks)) {
    if (visited.has(start.id)) continue;
    const component: GameTask[] = [];
    const pending = [start.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      component.push(byId.get(id)!);
      pending.push(...neighbours.get(id)!);
    }
    const groups = new Map<number, GameTask[]>();
    for (const task of component) {
      const layer = layers.get(task.id) ?? 0;
      const group = groups.get(layer) ?? [];
      group.push(task);
      groups.set(layer, group);
    }
    for (const group of groups.values()) group.sort(compareGraphTasks);
    const keys = [...groups.keys()].sort((a, b) => a - b);
    const height = Math.max(...[...groups.values()].map((group) => group.length));
    const positions = () =>
      new Map(
        [...groups.values()].flatMap((group) =>
          group.map((task, index) => [task.id, (height - group.length) / 2 + index] as const),
        ),
      );
    const crossings = (position: Map<string, number>) => {
      const edges = component.flatMap((task) =>
        [...incoming.get(task.id)!].map((from) => ({ from, to: task.id })),
      );
      let count = 0;
      for (let a = 0; a < edges.length; a++)
        for (let b = a + 1; b < edges.length; b++) {
          const one = edges[a],
            two = edges[b];
          if (
            layers.get(one.from) === layers.get(two.from) &&
            layers.get(one.to) === layers.get(two.to) &&
            (position.get(one.from)! - position.get(two.from)!) *
              (position.get(one.to)! - position.get(two.to)!) <
              0
          )
            count++;
        }
      return count;
    };
    let best = positions(),
      bestScore = crossings(best);
    for (let sweep = 0; sweep < 8; sweep++) {
      const forward = sweep % 2 === 0;
      for (const key of forward ? keys : [...keys].reverse()) {
        const position = positions();
        const group = groups.get(key)!;
        const score = (task: GameTask) => {
          const adjacent = [...(forward ? incoming : outgoing).get(task.id)!].filter(
            (id) => layers.get(id) !== key,
          );
          return adjacent.length
            ? adjacent.reduce((sum, id) => sum + position.get(id)!, 0) / adjacent.length
            : position.get(task.id)!;
        };
        group.sort(
          (a, b) =>
            score(a) - score(b) ||
            position.get(a.id)! - position.get(b.id)! ||
            compareGraphTasks(a, b),
        );
      }
      const candidate = positions(),
        score = crossings(candidate);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    for (const [id, row] of best) rows.set(id, offset + row);
    offset += height + 1;
  }
  return rows;
}
