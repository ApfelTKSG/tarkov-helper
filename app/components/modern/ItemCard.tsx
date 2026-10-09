import type { ReactNode } from 'react';
import ItemCounter from './ItemCounter';

export default function ItemCard({
  title,
  label = title,
  items,
  value,
  maximum,
  onChange,
  disabled,
  foundInRaid,
  children,
}: {
  title: string;
  label?: string;
  items: string[];
  value: number;
  maximum: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  foundInRaid?: boolean;
  children?: ReactNode;
}) {
  const complete = value >= maximum;
  return (
    <div
      className={`min-w-0 rounded border p-3 ${complete ? 'border-emerald-400 bg-emerald-950/30' : 'border-slate-600'}`}
    >
      <ItemCounter
        compact
        items={items}
        label={label}
        value={value}
        maximum={maximum}
        onChange={onChange}
        disabled={disabled}
        heading={
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold" title={title}>
              {title} {foundInRaid && <span className="text-[10px] text-amber-300">FiR</span>}
              {items.length > 1 && (
                <span className="text-xs font-normal text-slate-400">{items.length}候補</span>
              )}
            </h3>
            <span
              className={`shrink-0 text-xs ${complete ? 'text-emerald-300' : 'text-amber-300'}`}
            >
              {complete ? '確保済' : `残り ${maximum - value}`}
            </span>
          </div>
        }
      />
      {children}
    </div>
  );
}
