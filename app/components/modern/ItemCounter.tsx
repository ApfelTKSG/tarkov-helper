'use client';

import { useGame } from '@/app/context/GameContext';
import { useState } from 'react';
import ApiImage from './ApiImage';

export default function ItemCounter({
  items,
  label,
  value,
  maximum,
  onChange,
  disabled = false,
}: {
  items: string[];
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const { snapshot } = useGame();
  const [showAll, setShowAll] = useState(false);
  const complete = value >= maximum;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {(showAll ? items : items.slice(0, 8)).map((id) => {
          const item = snapshot?.items[id];
          const name = item?.name ?? id;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              aria-pressed={complete}
              aria-label={`${label} ${name} ${maximum === 1 ? '確保・取り消し' : '1個追加'}`}
              title={`${name} · ${maximum === 1 ? 'クリックで確保・取り消し' : 'クリックで1個追加'}`}
              className={`rounded border-2 bg-slate-950/40 p-1 disabled:opacity-50 ${complete ? 'border-emerald-400 ring-2 ring-emerald-500/40' : 'border-slate-600 hover:border-sky-400'}`}
              onClick={() => onChange(maximum === 1 && complete ? 0 : Math.min(maximum, value + 1))}
            >
              <ApiImage src={item?.iconLink} name={name} className="h-20 w-20 object-contain" />
            </button>
          );
        })}
      </div>
      {items.length > 8 && (
        <button
          type="button"
          className="text-sm text-sky-300 underline"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? '候補を折りたたむ' : `残り${items.length - 8}個の候補画像を表示`}
        </button>
      )}
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          className="rounded border border-slate-600 px-3 py-1 disabled:opacity-40"
          aria-label={`${label} 1個減らす`}
          disabled={disabled || value === 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <input
          aria-label={`${label} 確保数`}
          className="w-20 rounded border border-slate-600 bg-slate-900 px-2 py-1"
          type="number"
          min="0"
          max={maximum}
          step="1"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isInteger(next) && next >= 0 && next <= maximum) onChange(next);
          }}
        />
        <span className={complete ? 'text-emerald-300' : 'text-slate-300'}>
          / {maximum}
          {complete ? ' ✓' : ''}
        </span>
      </div>
    </div>
  );
}
