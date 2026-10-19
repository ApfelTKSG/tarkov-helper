'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { visibleTrader } from '@/src/domain/traders';
import ApiImage from './ApiImage';

const itemClass = (selected: boolean) =>
  `flex w-fit shrink-0 items-center justify-center rounded border-2 p-1 ${selected ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-800 hover:border-sky-400'}`;

export default function TraderNavigation({
  trader,
  allSelected,
}: {
  trader?: string;
  allSelected: boolean;
}) {
  const { snapshot } = useGame();
  return (
    <nav aria-label="トレーダー" className="flex gap-1 overflow-x-auto pb-1 text-xs">
      <Link
        href="/"
        aria-label="全トレーダー"
        title="全トレーダー"
        aria-current={allSelected ? 'page' : undefined}
        className={itemClass(allSelected)}
      >
        <span className="flex h-9 w-9 items-center justify-center text-2xl" aria-hidden="true">
          ▦
        </span>
      </Link>
      {snapshot?.traders
        .filter((t) => visibleTrader(t) && snapshot.tasks.some((task) => task.trader === t.id))
        .map((t) => (
          <Link
            key={t.id}
            href={`/traders/${traderNameToSlug(t.englishName)}`}
            aria-label={t.name}
            title={t.name}
            aria-current={trader === t.englishName ? 'page' : undefined}
            className={itemClass(trader === t.englishName)}
          >
            <ApiImage src={t.imageLink} name={t.name} className="h-9 w-9 rounded object-cover" />
          </Link>
        ))}
    </nav>
  );
}
