'use client';

import type { GameTask } from '@/src/domain/game';
import { raidPackingList } from '@/src/domain/raid-packing';
import { useGame } from '@/app/context/GameContext';
import ApiImage from './ApiImage';

export default function RaidPackingList({ tasks, map }: { tasks: GameTask[]; map: string }) {
  const { snapshot, profile } = useGame();
  if (!snapshot) return null;
  const { keys, markers } = raidPackingList(tasks, profile, map);
  return (
    <details open className="shrink-0 border-b border-slate-700 pb-3 text-sm">
      <summary className="cursor-pointer text-slate-300">
        持ち物候補{' '}
        <span className="ml-2 text-xs text-slate-400">
          キー {keys.length}種 · 消耗品 {markers.length}種
        </span>
      </summary>
      <ul className="mt-2 flex max-h-28 flex-wrap gap-x-5 gap-y-2 overflow-y-auto text-[13px]">
        {keys.map((id) => (
          <li
            key={`key-${id}`}
            className="flex items-center gap-2"
            title="キー候補（代替を含む・同じキーは再利用）"
          >
            <ApiImage
              src={snapshot.items[id]?.iconLink}
              name={snapshot.items[id]?.name ?? id}
              className="h-7 w-7 object-contain"
            />
            <span>{snapshot.items[id]?.name ?? id}</span>
          </li>
        ))}
        {markers.map(({ item, count }) => (
          <li key={`marker-${item}`} className="flex items-center gap-2">
            <ApiImage
              src={snapshot.items[item]?.iconLink}
              name={snapshot.items[item]?.name ?? item}
              className="h-7 w-7 object-contain"
            />
            <span>{snapshot.items[item]?.name ?? item}</span>
            <span className="tabular-nums text-slate-300">×{count}</span>
          </li>
        ))}
      </ul>
      {!keys.length && !markers.length && (
        <p className="mt-2 text-xs text-slate-400">
          今できるタスクに、キー・マーカーの指定はありません。
        </p>
      )}
    </details>
  );
}
