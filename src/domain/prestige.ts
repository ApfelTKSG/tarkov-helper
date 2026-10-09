import type { GameSnapshot, GameTask } from './game';

/** Wiki links distinguish the destination prestige, even when every name is identical. */
export function newBeginningStage(task: GameTask): number | undefined {
  const match = /New_Beginning_\(Prestige_(\d+)\)/.exec(task.wikiLink ?? '');
  return match ? Number(match[1]) : undefined;
}

export function matchesPrestige(task: GameTask, current: number | undefined): boolean {
  const stage = newBeginningStage(task);
  return stage === undefined || current === undefined || stage === current + 1;
}

export function prestigeCoverage(snapshot: GameSnapshot, current: number): boolean {
  return snapshot.tasks.some((task) => newBeginningStage(task) === current + 1);
}
