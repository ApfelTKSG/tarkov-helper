'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { remainingFirItems } from '@/src/domain/items';
import { traderNameToSlug } from '@/app/lib/traderSlug';

export default function ItemOverview({ tasks }: { tasks: GameTask[] }) {
  const { snapshot, profile } = useGame();
  if (!snapshot) return null;
  const groups = remainingFirItems(tasks, profile);
  const taskLink = (id: string) => {
    const task = snapshot.tasks.find((task) => task.id === id);
    const trader = snapshot.traders.find((trader) => trader.id === task?.trader);
    return trader ? `/traders/${traderNameToSlug(trader.englishName)}#task-${id}` : '/';
  };
  return (
    <details open className="rounded-xl border border-slate-700 bg-slate-800 p-4">
      <summary className="cursor-pointer font-semibold text-amber-300">
        残りのFiRアイテム・逆引き
      </summary>
      <p className="my-2 text-sm text-slate-300">
        必須の納品目標を集計しています。候補が複数ある目標は「いずれか」の合計数として分け、各候補に必要数を重複加算しません。受注中だけを見る場合は表示対象を切り替えてください。
      </p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {groups.singles.map((group) => (
          <article key={group.itemId} className="rounded border border-slate-600 p-3">
            <h3 className="font-semibold">
              {snapshot.items[group.itemId]?.name ?? group.itemId}{' '}
              <span className="text-amber-300">残り {group.count}</span>
            </h3>
            <ul className="mt-2 space-y-1 text-sm">
              {group.demands.map((demand) => (
                <li key={`${demand.taskId}:${demand.objectiveId}`}>
                  <Link className="text-sky-300 hover:underline" href={taskLink(demand.taskId)}>
                    {demand.taskName}
                  </Link>{' '}
                  × {demand.count}
                </li>
              ))}
            </ul>
          </article>
        ))}
        {groups.alternatives.map((group) => (
          <article
            key={`${group.demand.taskId}:${group.demand.objectiveId}`}
            className="rounded border border-slate-600 p-3"
          >
            <h3 className="font-semibold">
              いずれか合計 <span className="text-amber-300">残り {group.demand.count}</span>
            </h3>
            <p className="mt-1 text-sm">
              {group.candidates.map((id) => snapshot.items[id]?.name ?? id).join(' / ')}
            </p>
            <Link
              className="mt-2 block text-sm text-sky-300 hover:underline"
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
