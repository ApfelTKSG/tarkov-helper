'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { GameTask } from '@/src/domain/game';
import { taskFirEntries } from '@/src/domain/task-row';
import { useGame } from '@/app/context/GameContext';
import ApiImage from './ApiImage';
import ItemCounter from './ItemCounter';

export default function TaskFirPopover({
  task,
  onSaved,
}: {
  task: GameTask;
  onSaved: (message: string) => void;
}) {
  const { profile, snapshot, edit, ready, storageError } = useGame();
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0, height: 320 });
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
  if (!snapshot) return null;
  const entries = taskFirEntries(task, profile.objectiveCounts);
  if (!entries.length) return null;
  const items = [...new Set(entries.flatMap((entry) => entry.items))];
  const complete = profile.tasks[task.id] === 'complete';
  const secured =
    complete ||
    entries.every((entry) => entry.maximum !== undefined && entry.value >= entry.maximum);
  return (
    <>
      <button
        type="button"
        aria-label={`${task.name} FiR確保数`}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="dialog"
        popoverTarget={id}
        className={`flex max-w-full items-center gap-1 rounded border p-0.5 hover:bg-slate-700/40 ${secured ? 'border-emerald-400/70' : 'border-transparent'}`}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const below = window.innerHeight - rect.bottom - 14;
          const height = Math.min(360, Math.max(80, below >= 140 ? below : rect.top - 14));
          const top = below >= 140 ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
          setPosition({
            left: Math.max(
              8,
              Math.min(rect.left, window.innerWidth - Math.min(360, window.innerWidth - 16) - 8),
            ),
            top,
            height,
          });
        }}
      >
        {items.slice(0, 3).map((item) => (
          <ApiImage
            key={item}
            src={snapshot.items[item]?.iconLink}
            name={snapshot.items[item]?.name ?? item}
            className="h-7 w-7 rounded object-contain"
          />
        ))}
        {items.length > 3 && (
          <span aria-hidden="true" className="px-1 text-slate-400">
            …
          </span>
        )}
        {!items.length && (
          <span aria-hidden="true" className="px-1 text-slate-400">
            …
          </span>
        )}
      </button>
      <div
        ref={panel}
        id={id}
        popover="auto"
        role="dialog"
        aria-label={`${task.name} FiRの確保数`}
        onToggle={(event) => setOpen(event.newState === 'open')}
        className="fixed m-0 w-[min(360px,calc(100vw-16px))] overflow-y-auto overscroll-contain rounded-lg border border-slate-600 bg-slate-950 p-3 text-slate-100 shadow-2xl"
        style={{ left: position.left, top: position.top, maxHeight: position.height }}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <p className="text-xs font-medium">{task.name} · FiR</p>
          <button
            type="button"
            aria-label="FiR編集を閉じる"
            popoverTarget={id}
            popoverTargetAction="hide"
            className="px-1 text-slate-400 hover:text-white"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          {entries.map((entry) => (
            <div key={entry.id}>
              <p className="mb-2 text-xs text-slate-400">{entry.description}</p>
              {entry.maximum !== undefined && entry.items.length ? (
                <ItemCounter
                  compact
                  items={entry.items}
                  label={`${task.name} ${entry.description}`}
                  value={entry.value}
                  maximum={entry.maximum}
                  disabled={!ready || !!storageError || complete}
                  onChange={(value) => {
                    if (
                      edit((p) => ({
                        ...p,
                        objectiveCounts: { ...p.objectiveCounts, [entry.key]: value },
                      }))
                    )
                      onSaved(`FiRを記録しました：${value}/${entry.maximum}`);
                  }}
                />
              ) : (
                <p className="text-xs text-slate-500">数量・候補はWikiで確認</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
