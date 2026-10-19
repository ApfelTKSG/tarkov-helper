'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { remainingFirItems, setFirGroupCount, type ItemDemand } from '@/src/domain/items';
import ItemCounter from './ItemCounter';
import Toast from './Toast';
import { COLLECTOR_ID } from './CollectorBadge';
import { traderNameToSlug } from '@/app/lib/traderSlug';

export default function ItemOverview({
  tasks,
  query = '',
  remainingOnly = false,
}: {
  tasks: GameTask[];
  query?: string;
  remainingOnly?: boolean;
}) {
  const { snapshot, profile, edit, storageError, ready } = useGame();
  const [saved, setSaved] = useState<{ key: number; message: string } | null>(null);
  const closeToast = useCallback(() => setSaved(null), []);
  if (!snapshot) return null;
  // Retain secured objectives for checking and undoing; preserve existing task allocation keys.
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
  const entries = [
    ...groups.singles.map((group) => ({
      key: group.itemId,
      items: [group.itemId],
      demands: group.demands,
      maximum: group.count,
      title: snapshot.items[group.itemId]?.name ?? group.itemId,
    })),
    ...groups.alternatives.map((group) => ({
      key: `${group.demand.taskId}:${group.demand.objectiveId}`,
      items: group.candidates,
      demands: [group.demand],
      maximum: group.demand.count,
      title: `いずれか合計 · ${group.candidates.length}候補`,
    })),
  ].map((entry) => ({ ...entry, value: countFor(entry.demands) }));
  const needle = query.normalize('NFKC').trim().toLocaleLowerCase();
  const visible = entries
    .filter(
      (entry) =>
        (!remainingOnly || entry.value < entry.maximum) &&
        (!needle ||
          [
            entry.title,
            ...entry.items.flatMap((id) => {
              const item = snapshot.items[id];
              return [id, item?.name, item?.englishName, item?.shortName];
            }),
            ...entry.demands.map((demand) => demand.taskName),
          ]
            .filter(Boolean)
            .join(' ')
            .normalize('NFKC')
            .toLocaleLowerCase()
            .includes(needle)),
    )
    .sort(
      (a, b) =>
        Number(a.value >= a.maximum) - Number(b.value >= b.maximum) ||
        a.title.localeCompare(b.title, 'ja'),
    );
  const taskLink = (id: string) => {
    const task = snapshot.tasks.find((task) => task.id === id);
    const trader = snapshot.traders.find((trader) => trader.id === task?.trader);
    return trader ? `/traders/${traderNameToSlug(trader.englishName)}#task-${id}` : '/';
  };
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 text-xs text-slate-400">
        <span>{visible.length}種類</span>
        <span>
          確保済み{' '}
          <span className="tabular-nums text-slate-200">
            {entries.filter((entry) => entry.value >= entry.maximum).length} / {entries.length}
          </span>{' '}
          種類
        </span>
      </div>
      <div
        role="region"
        aria-label="FiRアイテム（スクロール）"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-slate-700 [scrollbar-gutter:stable]"
      >
        <div className="grid items-start gap-x-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((entry) => (
            <article
              key={entry.key}
              aria-label={`${entry.title} 確保状況`}
              className={`min-w-0 border-b border-slate-700 py-3 ${entry.value >= entry.maximum ? 'bg-emerald-950/20' : ''}`}
            >
              <ItemCounter
                compact
                items={entry.items}
                label={entry.title}
                value={entry.value}
                maximum={entry.maximum}
                disabled={!ready || !!storageError}
                onChange={(total) => {
                  if (edit((p) => setFirGroupCount(p, entry.demands, total)))
                    setSaved({ key: Date.now(), message: '確保数を保存しました' });
                }}
                heading={
                  <h2 className="truncate text-sm font-medium" title={entry.title}>
                    {entry.title}
                  </h2>
                }
              />
              <details className="mt-2 text-xs">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-slate-400 hover:text-slate-100">
                  <span>
                    必要タスク {new Set(entry.demands.map((demand) => demand.taskId)).size}件 ▾
                  </span>
                  {entry.demands.some((demand) => demand.taskId === COLLECTOR_ID) && (
                    <span className="text-[11px] text-amber-200/80">Collector</span>
                  )}
                </summary>
                <ul className="mt-2 space-y-2">
                  {entry.demands.map((demand) => (
                    <li
                      key={`${demand.taskId}:${demand.objectiveId}`}
                      className="flex justify-between gap-2"
                    >
                      <Link
                        className="ui-link min-w-0 truncate hover:underline"
                        href={taskLink(demand.taskId)}
                      >
                        {demand.taskName} ↗
                      </Link>
                      <span className="shrink-0 tabular-nums text-slate-400">×{demand.count}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
        {!visible.length && (
          <p className="py-12 text-center text-sm text-slate-400">
            {entries.length
              ? '条件に合うアイテムはありません。'
              : '必要なFiRアイテムはありません。'}
          </p>
        )}
      </div>
      {saved && <Toast key={saved.key} message={saved.message} onClose={closeToast} />}
    </>
  );
}
