'use client';

import { useEffect, useRef } from 'react';
import type { GameTask } from '@/src/domain/game';
import TaskPanel from './TaskPanel';

export default function TaskDialog({ task, onClose }: { task: GameTask; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={`${task.name} 詳細`}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[min(900px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-600 bg-slate-900 p-4 text-slate-100 shadow-2xl backdrop:bg-black/70"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold">タスク詳細</h2>
        <button
          autoFocus
          className="rounded border border-slate-600 bg-slate-800 px-3 py-2"
          onClick={onClose}
        >
          閉じる（Esc）
        </button>
      </div>
      <TaskPanel task={task} />
    </dialog>
  );
}
