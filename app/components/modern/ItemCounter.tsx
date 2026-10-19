'use client';

import { useGame } from '@/app/context/GameContext';
import { useState, type ReactNode } from 'react';
import ApiImage from './ApiImage';
import ItemChoicesPopover from './ItemChoicesPopover';

export default function ItemCounter({
  items,
  label,
  value,
  maximum,
  onChange,
  disabled = false,
  heading,
  compact = false,
  choicesPopover = false,
  imageLimit = 8,
}: {
  items: string[];
  label: string;
  value: number;
  maximum: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  heading?: ReactNode;
  compact?: boolean;
  choicesPopover?: boolean;
  imageLimit?: number;
}) {
  const { snapshot } = useGame();
  const [showAll, setShowAll] = useState(false);
  const complete = value >= maximum;
  const condensedChoices = choicesPopover && items.length > 1;
  return (
    <div
      className={
        (compact && items.length === 1) || condensedChoices
          ? 'grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-3 gap-y-1'
          : 'space-y-2'
      }
    >
      {heading && (
        <div
          className={
            (items.length === 1 && compact) || condensedChoices
              ? 'col-start-2 row-start-1 min-w-0'
              : ''
          }
        >
          {heading}
        </div>
      )}
      <div
        className={
          (compact && items.length === 1) || condensedChoices
            ? 'col-start-1 row-start-1 row-span-2'
            : 'flex flex-wrap gap-2'
        }
      >
        {condensedChoices ? (
          <ItemChoicesPopover items={items} label={label} complete={complete}>
            <ItemCounter
              compact
              items={items}
              label={label}
              value={value}
              maximum={maximum}
              onChange={onChange}
              disabled={disabled}
              imageLimit={items.length}
            />
          </ItemChoicesPopover>
        ) : (
          (showAll ? items : items.slice(0, imageLimit)).map((id) => {
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
                className={`rounded border bg-slate-950/40 p-1 disabled:opacity-50 ${compact && items.length === 1 ? 'flex h-14 w-full items-center justify-center' : ''} ${complete ? 'border-emerald-400' : 'border-slate-600 hover:border-slate-400'}`}
                onClick={() =>
                  onChange(maximum === 1 && complete ? 0 : Math.min(maximum, value + 1))
                }
              >
                <ApiImage
                  src={item?.iconLink}
                  name={name}
                  className={compact ? 'h-12 w-12 object-contain' : 'h-20 w-20 object-contain'}
                />
              </button>
            );
          })
        )}
      </div>
      {!condensedChoices && items.length > imageLimit && (
        <button
          type="button"
          className="text-sm text-sky-300 underline"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? '候補を折りたたむ' : `残り${items.length - imageLimit}個の候補画像を表示`}
        </button>
      )}
      <div
        className={`flex items-center gap-1 text-sm tabular-nums ${(compact && items.length === 1) || condensedChoices ? 'col-start-2 row-start-2' : ''}`}
      >
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-600 hover:border-slate-400 disabled:opacity-40"
          aria-label={`${label} 1個減らす`}
          disabled={disabled || value === 0}
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          −
        </button>
        <input
          aria-label={`${label} 確保数`}
          className={`ui-item-count ${compact ? 'w-12' : 'w-20'} h-7 shrink-0 rounded border border-slate-600 bg-slate-900 px-1 text-center`}
          type="number"
          inputMode="numeric"
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
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-600 hover:border-slate-400 disabled:opacity-40"
          aria-label={`${label} 1個追加`}
          disabled={disabled || value >= maximum}
          onClick={() => onChange(Math.min(maximum, value + 1))}
        >
          +
        </button>
        <span
          className={`ml-1 whitespace-nowrap ${complete ? 'text-emerald-300' : 'text-slate-300'}`}
        >
          / {maximum}
          {complete ? ' ✓' : ''}
        </span>
      </div>
    </div>
  );
}
