'use client';

import { useEffect, useState } from 'react';

export default function Toast({
  message,
  action,
  onClose,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(onClose, 7000);
    return () => clearTimeout(timer);
  }, [paused, onClose]);
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-5 left-1/2 z-50 flex w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 items-center gap-4 rounded-xl border border-slate-500 bg-slate-800 px-4 py-3 text-sm text-slate-100 shadow-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <span className="min-w-0 flex-1">{message}</span>
      {action && (
        <button
          type="button"
          className="shrink-0 font-medium text-sky-300 hover:underline"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="通知を閉じる"
        className="shrink-0 rounded px-1 text-slate-400 hover:text-white"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
}
