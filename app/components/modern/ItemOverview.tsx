'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { remainingFirItems, setFirGroupCount, type ItemDemand } from '@/src/domain/items';
import ItemCounter from './ItemCounter';
import { traderNameToSlug } from '@/app/lib/traderSlug';

export default function ItemOverview({ tasks }: { tasks: GameTask[] }) {
  const { snapshot, profile, edit, storageError, ready } = useGame();
  if (!snapshot) return null;
  // Keep achieved objectives visible so their green state can be checked and undone.
  const groups = remainingFirItems(tasks, { ...profile, objectiveCounts: {} });
  const countFor = (demands: ItemDemand[]) =>
    demands.reduce(
      (sum, demand) =>
        sum +
        Math.min(
          profile.objectiveCounts[`${demand.taskId}:${demand.objectiveId}`] ?? 0,
          demand.count,
        ),
      0,
    );
  const taskLink = (id: string) => {
    const task = snapshot.tasks.find((task) => task.id === id);
    const trader = snapshot.traders.find((trader) => trader.id === task?.trader);
    return trader ? `/traders/${traderNameToSlug(trader.englishName)}#task-${id}` : '/';
  };
  return (
    <details open className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <summary className="cursor-pointer font-semibold text-amber-300">FiRアイテム・確保数</summary>
      <p className="my-2 text-sm text-slate-300">
        画像を押すと1個追加。必要数に達すると緑枠になります。1個だけ必要な場合は、もう一度押すと取り消せます。「−」や個数入力でも調整できます。候補が複数ある目標は、いずれかの合計数で記録します。
      </p>
      <div className="grid items-start gap-2 md:grid-cols-2 lg:grid-cols-3">
        {groups.singles.map((group) => (
          <article
            key={group.itemId}
            className={`rounded border p-3 ${countFor(group.demands) >= group.count ? 'border-emerald-400 bg-emerald-950/30' : 'border-slate-600'}`}
          >
            <ItemCounter
              compact
              heading={
                <div className="flex items-start justify-between gap-2">
                  <h3
                    className="line-clamp-2 text-sm font-semibold"
                    title={snapshot.items[group.itemId]?.name ?? group.itemId}
                  >
                    {snapshot.items[group.itemId]?.name ?? group.itemId}
                  </h3>
                  <span
                    className={`shrink-0 text-xs ${countFor(group.demands) >= group.count ? 'text-emerald-300' : 'text-amber-300'}`}
                  >
                    {countFor(group.demands) >= group.count
                      ? '確保済'
                      : `残り ${group.count - countFor(group.demands)}`}
                  </span>
                </div>
              }
              items={[group.itemId]}
              label={snapshot.items[group.itemId]?.name ?? group.itemId}
              value={countFor(group.demands)}
              maximum={group.count}
              disabled={!ready || !!storageError}
              onChange={(total) => edit((p) => setFirGroupCount(p, group.demands, total))}
            />
            <details className="mt-2 border-t border-slate-700 pt-2 text-xs">
              <summary className="cursor-pointer text-slate-400 hover:text-sky-300">
                必要タスク {group.demands.length}件
              </summary>
              <ul className="mt-2 space-y-1">
                {group.demands.map((demand) => (
                  <li key={`${demand.taskId}:${demand.objectiveId}`}>
                    <Link className="text-sky-300 hover:underline" href={taskLink(demand.taskId)}>
                      {demand.taskName}
                    </Link>{' '}
                    × {demand.count}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        ))}
        {groups.alternatives.map((group) => (
          <article
            key={`${group.demand.taskId}:${group.demand.objectiveId}`}
            className={`rounded border p-3 ${countFor([group.demand]) >= group.demand.count ? 'border-emerald-400 bg-emerald-950/30' : 'border-slate-600'}`}
          >
            <ItemCounter
              compact
              heading={
                <div className="flex items-start justify-between gap-2 text-sm">
                  <h3 className="font-semibold">
                    いずれか合計{' '}
                    <span className="text-xs font-normal text-slate-400">
                      {group.candidates.length}候補
                    </span>
                  </h3>
                  <span className="shrink-0 text-xs text-amber-300">
                    残り {group.demand.count - countFor([group.demand])}
                  </span>
                </div>
              }
              items={group.candidates}
              label={`${group.demand.taskName} ${group.demand.objectiveId}`}
              value={countFor([group.demand])}
              maximum={group.demand.count}
              disabled={!ready || !!storageError}
              onChange={(total) => edit((p) => setFirGroupCount(p, [group.demand], total))}
            />
            <Link
              className="mt-2 block truncate border-t border-slate-700 pt-2 text-xs text-sky-300 hover:underline"
              href={taskLink(group.demand.taskId)}
            >
              {group.demand.taskName}
            </Link>
          </article>
        ))}
      </div>
      {!groups.singles.length && !groups.alternatives.length && (
        <p className="text-sm text-slate-400">この表示対象に残りの必須FiR納品はありません。</p>
      )}
    </details>
  );
}
