import type { GameTask, GameSnapshot } from './game';
import type { Profile } from './profiles';
import type { Availability } from './progression';
import { isActionable } from './trader-dashboard.ts';
import { effectiveTraderProgress, traderUnlocked } from './traders.ts';
import { taskMapIds } from './maps.ts';
import { taskLoyaltyColumn } from './task-columns.ts';

export const lockedGroups = [
  ['unknown', '条件不明'],
  ['playerLevel', 'レベル不足'],
  ['count', '前提タスク数不足'],
  ['task', '前提タスク未クリア'],
  ['level', 'LL不足'],
  ['multiple', '複数条件不足'],
  ['failed', '失敗'],
] as const;
type Group = (typeof lockedGroups)[number][0];
type TaskLock = { group: Group; rank: number[]; hint: string };

/** Unknown gates stay explicit; they are never inferred to be a known shortage. */
export function taskLock(
  task: GameTask,
  profile: Profile,
  result: Availability,
  snapshot: GameSnapshot,
): TaskLock | undefined {
  if (profile.tasks[task.id] === 'complete' || isActionable(task, profile, result))
    return undefined;
  if (profile.tasks[task.id] === 'failed')
    return {
      group: 'failed',
      rank: [taskLoyaltyColumn(task, snapshot.tasks) || Infinity],
      hint: '失敗',
    };
  return taskConditionLock(task, profile, result, snapshot);
}

/** Classify the conditions independently of recorded acceptance and manual overrides. */
export function taskConditionLock(
  task: GameTask,
  profile: Profile,
  result: Availability,
  snapshot: GameSnapshot,
): TaskLock | undefined {
  if (
    result.conditions.every((condition) => condition.state === 'met') &&
    traderUnlocked(task.trader, profile)
  )
    return undefined;
  // Keep each LL together before comparing shortages; unclassified tasks come last.
  const tier = taskLoyaltyColumn(task, snapshot.tasks) || Infinity;
  const categories = new Set<Group>();
  let playerLevel = 0,
    countGap = 0,
    prerequisiteCount = 0,
    loyaltyLevel = 0,
    loyaltyGap = 0;
  const hints: string[] = [];
  let unknown = false;
  for (const condition of result.conditions.filter((c) => c.state !== 'met')) {
    const requirement = task.otherRequirements?.find(
      (req) => `${task.id}:${req.id}` === condition.reference,
    );
    const counter = condition.counter;
    if (condition.state === 'unknown') {
      unknown = true;
      continue;
    }
    if (condition.kind === 'playerLevel') {
      categories.add('playerLevel');
      playerLevel = task.minPlayerLevel ?? Infinity;
      hints.push(`レベル ${task.minPlayerLevel}～`);
    } else if (counter?.derived && ['>=', '>'].includes(String(requirement?.compareMethod))) {
      const required =
        requirement!.compareMethod === '>'
          ? Math.floor(counter.required) + 1
          : Math.ceil(counter.required);
      const remaining = Math.max(0, required - counter.completed);
      categories.add('count');
      countGap = Math.max(countGap, remaining);
      hints.push(`あと${remaining}タスク`);
    } else if (condition.kind === 'task') {
      categories.add('task');
    } else if (condition.kind === 'level') {
      const req = task.traderRequirements.find(
        (req) => req.trader === condition.reference && req.requirementType === 'level',
      );
      if (!req || !['>=', '>'].includes(req.compareMethod)) {
        unknown = true;
        continue;
      }
      categories.add('level');
      const trader = snapshot.traders.find((t) => t.id === condition.reference);
      const current = trader ? effectiveTraderProgress(trader, profile).level : undefined;
      const target = req
        ? req.compareMethod === '>'
          ? Math.floor(req.value) + 1
          : Math.ceil(req.value)
        : Infinity;
      loyaltyLevel = Math.max(loyaltyLevel, target);
      loyaltyGap = Math.max(
        loyaltyGap,
        current === undefined ? Infinity : Math.max(0, target - current),
      );
      hints.push(`LL ${target}～`);
    } else {
      unknown = true;
    }
  }
  if (!traderUnlocked(task.trader, profile)) {
    categories.add('task');
    hints.push('トレーダー未解放');
  }
  if (categories.has('task')) {
    const pending = task.taskRequirements
      .filter((req) => !req.status.includes(profile.tasks[req.task] ?? 'unstarted'))
      .map((req) => req.task);
    const seen = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (seen.has(id) || profile.tasks[id] === 'complete') continue;
      seen.add(id);
      for (const req of snapshot.tasks.find((t) => t.id === id)?.taskRequirements ?? [])
        if (!req.status.includes(profile.tasks[req.task] ?? 'unstarted')) pending.push(req.task);
    }
    prerequisiteCount = seen.size || 1;
    hints.push(`未完了の前提 ${seen.size || 1}件`);
  }
  const group: Group =
    categories.size > 1 || (categories.size > 0 && unknown)
      ? 'multiple'
      : ([...categories][0] ?? 'unknown');
  return {
    group,
    rank: [
      tier,
      ...(group === 'playerLevel'
        ? [playerLevel]
        : group === 'count'
          ? [countGap]
          : group === 'task'
            ? [prerequisiteCount]
            : group === 'level'
              ? [loyaltyLevel, loyaltyGap]
              : [
                  categories.size + Number(unknown),
                  unknown ? Infinity : 0,
                  Math.max(0, playerLevel - (profile.level ?? 0)),
                  countGap,
                  prerequisiteCount,
                  loyaltyGap,
                ]),
    ],
    hint: [...hints, ...(unknown ? ['要確認の条件あり'] : [])].join(' · '),
  };
}

export function compareLockRank(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0,
      y = b[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export function compareTaskMaps(a: GameTask, b: GameTask, snapshot: GameSnapshot): number {
  const key = (task: GameTask) =>
    taskMapIds(task)
      .map((id) => snapshot.maps.find((map) => map.id === id)?.name ?? id)
      .sort((a, b) => a.localeCompare(b, 'ja'))
      .join(' / ');
  const first = key(a),
    second = key(b);
  return !first ? (!second ? 0 : 1) : !second ? -1 : first.localeCompare(second, 'ja');
}
