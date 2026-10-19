'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useGame } from '@/app/context/GameContext';
import ApiImage from './ApiImage';

export default function ItemChoicesPopover({
  items,
  label,
  complete,
  children,
}: {
  items: string[];
  label: string;
  complete: boolean;
  children: ReactNode;
}) {
  const { snapshot } = useGame();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, height: 360 });
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      panel.current?.hidePopover();
    };
    window.addEventListener('resize', dismiss);
    document.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('resize', dismiss);
      document.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        popoverTarget={id}
        aria-label={`${label} 候補アイテム`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        className={`flex h-14 w-full flex-nowrap items-center justify-center gap-1 overflow-hidden rounded border p-1 ${complete ? 'border-emerald-400' : 'border-slate-600 hover:border-slate-400'}`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const below = window.innerHeight - rect.bottom - 14;
          const height = Math.min(420, Math.max(80, below >= 140 ? below : rect.top - 14));
          setPosition({
            left: Math.max(
              8,
              Math.min(rect.left, window.innerWidth - Math.min(400, window.innerWidth - 16) - 8),
            ),
            top: below >= 140 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6),
            height,
          });
        }}
      >
        {items.slice(0, 3).map((item) => (
          <ApiImage
            key={item}
            src={snapshot?.items[item]?.iconLink}
            name={snapshot?.items[item]?.name ?? item}
            className="h-6 w-6 shrink-0 object-contain"
          />
        ))}
        {items.length > 3 && (
          <span aria-hidden="true" className="shrink-0 text-slate-400">
            …
          </span>
        )}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={`${label} 候補アイテム一覧`}
        onToggle={(event) => setOpen(event.newState === 'open')}
        className="fixed m-0 w-[min(400px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-md border border-slate-700 bg-slate-800 p-3 text-slate-100 shadow-xl"
        style={{ left: position.left, top: position.top, maxHeight: position.height }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm font-medium">候補アイテム · {items.length}種類</p>
          <button
            type="button"
            popoverTarget={id}
            popoverTargetAction="hide"
            aria-label="候補アイテムを閉じる"
            className="px-1 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
        {open && children}
      </div>
    </>
  );
}
