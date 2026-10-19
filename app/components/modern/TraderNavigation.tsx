'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { visibleTrader } from '@/src/domain/traders';
import ApiImage from './ApiImage';

export default function TraderNavigation({
  trader,
  allSelected,
}: {
  trader?: string;
  allSelected: boolean;
}) {
  const { snapshot } = useGame();
  return (
    <nav aria-label="トレーダー" className="flex gap-1 overflow-x-auto text-xs">
      <Link
        href="/"
        aria-label="全トレーダー"
        title="全トレーダー"
        aria-current={allSelected ? 'page' : undefined}
        className="ui-trader-link"
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
            className="ui-trader-link"
          >
            <ApiImage src={t.imageLink} name={t.name} className="h-9 w-9 rounded object-cover" />
          </Link>
        ))}
    </nav>
  );
}
