'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { GameTask, GameTrader } from '@/src/domain/game';
import { useGame } from '@/app/context/GameContext';
import {
  isActionable,
  countCohortLabel,
  loyaltyGoal,
  standingReward,
  taskUnlockImpact,
  unlockMilestones,
} from '@/src/domain/trader-dashboard';
import { matchesTask } from '@/src/domain/task-view';
import { visibleMap } from '@/src/domain/maps';
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { matchesPrestige } from '@/src/domain/prestige';
import Toast from './Toast';
import TaskTable from './TaskTable';

const control = 'ui-control';
const number = (value: number) => value.toLocaleString('ja-JP', { maximumFractionDigits: 3 });

export default function TraderDashboard({
  trader,
  tasks,
  linkedTask,
  onClearLinked,
}: {
  trader: GameTrader;
  tasks: GameTask[];
  linkedTask?: GameTask;
  onClearLinked: () => void;
}) {
  const { profile, snapshot, availability, edit, ready, storageError } = useGame();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState<{
    key: string;
    taskIds: string[];
    label: string;
  } | null>(null);
  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 10_000);
    return () => clearTimeout(timer);
  }, [highlight]);
  const [toast, setToast] = useState<{ id: number; message: string; undoTask?: GameTask } | null>(
    null,
  );
  const toastId = useRef(0);
  const reputationChanged = useRef(false);
  const closeToast = useCallback(() => setToast(null), []);
  if (!snapshot) return null;
  const notify = (message: string, undoTask?: GameTask) =>
    setToast({ id: ++toastId.current, message, undoTask });
  const disabled = !ready || !!storageError;
  const results = new Map(snapshot.tasks.map((task) => [task.id, availability(task)]));
  const evaluate = (task: GameTask) => results.get(task.id)!;
  const available = tasks.filter((task) => isActionable(task, profile, evaluate(task)));
  const goal = loyaltyGoal(trader, profile, available);
  const milestones = unlockMilestones(tasks, profile, evaluate);
  const hasAvailable = (ids: string[]) =>
    snapshot.tasks.some(
      (task) =>
        ids.includes(task.id) &&
        matchesPrestige(task, profile.prestige) &&
        isActionable(task, profile, evaluate(task)),
    );
  const nextUnlock =
    milestones.find((milestone) => hasAvailable(milestone.taskIds)) ?? milestones[0];
  const focusIds = linkedTask ? [linkedTask.id] : null;
  const cohortLabel = nextUnlock ? countCohortLabel(nextUnlock.taskIds, snapshot.tasks) : '';
  const needle = query.normalize('NFKC').trim().toLocaleLowerCase();
  const visibleTasks = (
    focusIds
      ? snapshot.tasks.filter(
          (task) => focusIds.includes(task.id) && matchesPrestige(task, profile.prestige),
        )
      : tasks
  )
    .filter(
      (task) =>
        matchesTask(task, query, snapshot) ||
        (!!needle &&
          snapshot.maps
            .filter(visibleMap)
            .some(
              (map) =>
                `${map.name} ${map.englishName}`
                  .normalize('NFKC')
                  .toLocaleLowerCase()
                  .includes(needle) &&
                (task.map === map.id ||
                  task.objectives.some((objective) => objective.maps?.includes(map.id))),
            )),
    )
    .sort((a, b) => {
      const order =
        Number(isActionable(b, profile, evaluate(b))) -
        Number(isActionable(a, profile, evaluate(a)));
      if (order) return order;
      const first = taskUnlockImpact(a.id, milestones),
        second = taskUnlockImpact(b.id, milestones);
      return (
        (first.nearest ?? Infinity) - (second.nearest ?? Infinity) ||
        second.count - first.count ||
        standingReward(b, trader.id) - standingReward(a, trader.id) ||
        a.name.localeCompare(b.name)
      );
    });
  const showCandidates = (key: string, ids: string[], label: string) => {
    onClearLinked();
    const taskIds = available.filter((task) => ids.includes(task.id)).map((task) => task.id);
    setHighlight((current) =>
      current?.key === key || !taskIds.length ? null : { key, taskIds, label },
    );
  };
  const markComplete = (task: GameTask) => {
    const wasComplete = profile.tasks[task.id] === 'complete';
    if (edit((p) => toggleTaskCompletion(p, task)))
      notify(
        `${task.name}：${wasComplete ? '完了を取り消しました' : '完了を記録しました'}`,
        wasComplete ? undefined : task,
      );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <section
        aria-label="トレーダーの進捗"
        className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-3 border-b border-slate-700 pb-4 pt-1"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{trader.name}</h1>
          <span className="text-sm font-medium text-slate-400">
            {goal.current.level === undefined
              ? 'LL 未確定'
              : goal.current.level === 0
                ? '未解放'
                : `LL ${goal.current.level}`}
          </span>
        </div>
        <label className="grid gap-1 text-xs text-slate-400">
          信頼度
          <input
            aria-label={`${trader.name} 現在の信頼度`}
            type="number"
            step="0.01"
            placeholder="未入力"
            className={`${control} w-20 text-slate-100`}
            value={goal.current.reputation ?? ''}
            disabled={disabled}
            onChange={(event) => {
              const reputation = event.target.value === '' ? undefined : Number(event.target.value);
              if (reputation === undefined || Number.isFinite(reputation)) {
                if (
                  edit((p) => ({
                    ...p,
                    traders: { ...p.traders, [trader.id]: { ...p.traders[trader.id], reputation } },
                  }))
                )
                  reputationChanged.current = true;
              }
            }}
            onBlur={() => {
              if (reputationChanged.current) {
                notify('信頼度を保存しました');
                reputationChanged.current = false;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
        </label>
        {goal.target && (
          <button
            type="button"
            className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 border-l border-slate-700 px-6 py-2 text-left text-sm hover:bg-slate-800/60 disabled:opacity-50"
            disabled={!goal.minimumTasks}
            aria-pressed={highlight?.key === 'reputation'}
            title={
              goal.minimumTasks
                ? `押すと今できる候補を10秒間強調します。その中から${goal.minimumTasks}件で不足分の信頼度を稼げます。PMCレベルなどは別条件です。`
                : goal.reputationGap === undefined
                  ? '現在の信頼度を入力すると候補を表示します。'
                  : goal.reputationGap === 0
                    ? '必要な信頼度は達成済みです。'
                    : '今できるタスクだけでは不足分の信頼度を満たせません。'
            }
            onClick={() =>
              showCandidates(
                'reputation',
                goal.choices.map((task) => task.id),
                `強調した候補${goal.choices.length}件から${goal.minimumTasks}件で必要な信頼度を確保`,
              )
            }
          >
            <span className="text-slate-300">
              LL {goal.target.level}まで{' '}
              <strong className="font-medium text-slate-100">
                {goal.reputationGap === undefined
                  ? '信頼度を入力'
                  : goal.reputationGap === 0
                    ? '信頼度 達成'
                    : `信頼度 あと${number(goal.reputationGap)}`}
              </strong>
            </span>
            {goal.playerLevelGap !== undefined && goal.playerLevelGap > 0 && (
              <span className="text-slate-300">PMC あと{goal.playerLevelGap}レベル</span>
            )}
            {goal.playerLevelGap === undefined && (
              <span className="text-amber-200">PMCレベル未入力</span>
            )}
            {goal.minimumTasks !== undefined && goal.minimumTasks > 0 && (
              <span className="text-xs text-slate-400">
                信頼度を稼ぐ候補から {goal.minimumTasks}件
              </span>
            )}
          </button>
        )}
        {nextUnlock && (
          <button
            type="button"
            className="min-h-16 border-l border-slate-700 px-6 py-2 text-left hover:bg-slate-800/60 disabled:opacity-50"
            disabled={!hasAvailable(nextUnlock.taskIds)}
            aria-pressed={highlight?.key === nextUnlock.key}
            title={`${nextUnlock.targets.map(({ task }) => task.name).join(' / ')} の完了数条件。押すとカウント対象の未完了タスクを10秒間強調します。他の解放条件が残る場合があります。`}
            onClick={() =>
              showCandidates(
                nextUnlock.key,
                nextUnlock.taskIds.filter((id) => profile.tasks[id] !== 'complete'),
                `${cohortLabel}の完了数にカウント`,
              )
            }
          >
            <span className="block text-xs text-slate-400">次のタスクの解放に向けて</span>
            <span className="text-base font-medium">
              {cohortLabel} あと{nextUnlock.remaining}件
            </span>
            <span className="ml-3 text-xs text-slate-400">対象を強調</span>
          </button>
        )}
        <Link
          href={`/traders/${traderNameToSlug(trader.englishName)}/fir`}
          className="ui-link ml-auto text-xs hover:underline"
        >
          FiR一覧 ↗
        </Link>
      </section>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          aria-label="タスク・アイテム検索"
          className={`${control} min-w-40 flex-1`}
          placeholder="タスク・アイテム・マップを検索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="text-xs text-slate-400">{visibleTasks.length}件</span>
        {focusIds && (
          <button
            type="button"
            className="text-xs text-sky-300 hover:underline"
            onClick={() => {
              onClearLinked();
            }}
          >
            絞り込み解除 ×
          </button>
        )}
        <span role="status" className="sr-only">
          {highlight && `${highlight.label} · 10秒間強調`}
        </span>
        {highlight && (
          <button type="button" className="ui-link text-xs" onClick={() => setHighlight(null)}>
            強調を解除 ×
          </button>
        )}
      </div>
      <TaskTable
        tasks={visibleTasks}
        reputationTrader={trader.id}
        highlightedTaskIds={highlight?.taskIds}
        onComplete={markComplete}
        onSaved={notify}
      />
      {toast && (
        <Toast
          key={toast.id}
          message={toast.message}
          onClose={closeToast}
          action={
            toast.undoTask && profile.tasks[toast.undoTask.id] === 'complete'
              ? {
                  label: '取り消す',
                  onClick: () => {
                    const task = toast.undoTask!;
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
