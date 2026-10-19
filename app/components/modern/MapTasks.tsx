'use client';

import { useCallback, useRef, useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { taskMapIds } from '@/src/domain/maps';
import { matchesPrestige } from '@/src/domain/prestige';
import { visibleTrader } from '@/src/domain/traders';
import { isActionable } from '@/src/domain/trader-dashboard';
import { matchesTask } from '@/src/domain/task-view';
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import TaskTable from './TaskTable';
import Toast from './Toast';

const control = 'rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm';
export default function MapTasks() {
  const { snapshot, profile, availability, edit } = useGame();
  const [map, setMap] = useState('');
  const [status, setStatus] = useState('available');
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<string[] | null>(null);
  const [toast, setToast] = useState<{ id: number; message: string; undo?: GameTask } | null>(null);
  const serial = useRef(0);
  const closeToast = useCallback(() => setToast(null), []);
  if (!snapshot) return null;
  const notify = (message: string, undo?: GameTask) =>
    setToast({ id: ++serial.current, message, undo });
  const results = new Map(snapshot.tasks.map((task) => [task.id, availability(task)]));
  const actionable = (task: GameTask) => isActionable(task, profile, results.get(task.id)!);
  const scoped = snapshot.tasks.filter(
    (task) =>
      matchesPrestige(task, profile.prestige) &&
      snapshot.traders.some((t) => t.id === task.trader && visibleTrader(t)),
  );
  const idsFor = (task: GameTask) =>
    taskMapIds(
      task,
      ['complete', 'failed'].includes(profile.tasks[task.id] ?? '') ? undefined : profile,
    );
  const choices = snapshot.maps.filter((m) =>
    scoped.some((task) => taskMapIds(task).includes(m.id)),
  );
  const tasks = scoped
    .filter(
      (task) =>
        (!focus || focus.includes(task.id)) &&
        matchesTask(task, query, snapshot) &&
        (status === 'all' ||
          (status === 'available' && actionable(task)) ||
          (status === 'unfinished' &&
            !['complete', 'failed'].includes(profile.tasks[task.id] ?? '')) ||
          (status === 'locked' &&
            !['complete', 'failed'].includes(profile.tasks[task.id] ?? '') &&
            !actionable(task)) ||
          (status === 'complete' && profile.tasks[task.id] === 'complete')) &&
        (!map || (map === 'none' ? !idsFor(task).length : idsFor(task).includes(map))),
    )
    .sort(
      (a, b) =>
        Number(actionable(b)) - Number(actionable(a)) ||
        (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0) ||
        a.name.localeCompare(b.name),
    );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold">マップ別タスク</h1>
        <span className="text-xs text-slate-400">マップ名の件数は今できるタスク</span>
      </div>
      <nav aria-label="マップ" className="flex shrink-0 gap-2 overflow-x-auto pb-1">
        {[{ id: '', name: 'すべて' }, ...choices, { id: 'none', name: 'マップ指定なし' }].map(
          (choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={map === choice.id}
              onClick={() => {
                setMap(choice.id);
                setFocus(null);
              }}
              className={`${control} shrink-0 ${map === choice.id ? 'border-sky-400 text-sky-200' : 'text-slate-400'}`}
            >
              {choice.name}
              {choice.id && (
                <span className="ml-2 text-xs">
                  {
                    scoped.filter(
                      (task) =>
                        actionable(task) &&
                        (choice.id === 'none'
                          ? !idsFor(task).length
                          : idsFor(task).includes(choice.id)),
                    ).length
                  }
                </span>
              )}
            </button>
          ),
        )}
      </nav>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          aria-label="タスク・アイテム検索"
          className={`${control} min-w-40 flex-1`}
          placeholder="タスク・アイテムを検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="タスクの状態"
          className={control}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="available">今できる</option>
          <option value="unfinished">未完了</option>
          <option value="locked">解放待ち・要確認</option>
          <option value="complete">完了</option>
          <option value="all">すべて</option>
        </select>
        <span className="text-xs text-slate-500">{tasks.length}件</span>
        {focus && (
          <button type="button" className="text-xs text-sky-300" onClick={() => setFocus(null)}>
            絞り込み解除 ×
          </button>
        )}
      </div>
      <TaskTable
        tasks={tasks}
        showTrader
        onSaved={notify}
        onFocusTasks={(ids) => {
          setFocus(ids);
          setStatus('all');
          setMap('');
          setQuery('');
        }}
        onComplete={(task) => {
          const complete = profile.tasks[task.id] === 'complete';
          if (edit((p) => toggleTaskCompletion(p, task)))
            notify(
              `${task.name}：${complete ? '完了を取り消しました' : '完了を記録しました'}`,
              complete ? undefined : task,
            );
        }}
      />
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onClose={closeToast}
          action={
            toast.undo && profile.tasks[toast.undo.id] === 'complete'
              ? {
                  label: '取り消す',
                  onClick: () => {
                    const task = toast.undo!;
                    if (
                      edit((p) =>
                        p.tasks[task.id] === 'complete' ? toggleTaskCompletion(p, task) : p,
                      )
                    )
                      notify('完了の記録を取り消しました');
                  },
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
