'use client';

import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import type { GameTask, GameTrader } from '@/src/domain/game';
import { useGame } from '@/app/context/GameContext';
import {
  isActionable,
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

const control =
  'rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm disabled:opacity-40';
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
  const [focus, setFocus] = useState<string[] | null>(null);
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
  const focusIds = focus ?? (linkedTask ? [linkedTask.id] : null);
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
  const showCandidates = (ids: string[]) => {
    onClearLinked();
    setFocus(ids);
    setQuery('');
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
        className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">{trader.name}</h1>
          <span className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
            {goal.current.level === undefined
              ? 'LL 未確定'
              : goal.current.level === 0
                ? '未解放'
                : `LL ${goal.current.level}`}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="text-slate-300">
              LL {goal.target.level}まで{' '}
              <strong className="text-sky-200">
                {goal.reputationGap === undefined
                  ? '信頼度を入力'
                  : goal.reputationGap === 0
                    ? '信頼度 達成'
                    : `信頼度 +${number(goal.reputationGap)}`}
              </strong>
            </span>
            {goal.playerLevelGap !== undefined && goal.playerLevelGap > 0 && (
              <span className="text-amber-200">PMC あと{goal.playerLevelGap}レベル</span>
            )}
            {goal.playerLevelGap === undefined && (
              <span className="text-amber-200">PMCレベル未入力</span>
            )}
            {goal.minimumTasks !== undefined && goal.minimumTasks > 0 && (
              <button
                type="button"
                className="text-sky-300 hover:underline"
                title="今できるタスクを信頼度報酬順に選んだ目安。レベル・その他条件は別です。"
                onClick={() => showCandidates(goal.plan.map((task) => task.id))}
              >
                目安 {goal.minimumTasks}タスク →
              </button>
            )}
          </div>
        )}
        {nextUnlock && (
          <button
            type="button"
            className="text-left text-xs text-amber-200 hover:underline"
            title={`${nextUnlock.targets.map(({ task }) => task.name).join(' / ')}。完了数条件のみの残り件数です。LLなど別の条件が残る場合があります。`}
            onClick={() =>
              showCandidates(nextUnlock.taskIds.filter((id) => profile.tasks[id] !== 'complete'))
            }
          >
            次の完了数条件 あと{nextUnlock.remaining}件 →
          </button>
        )}
        <Link
          href={`/traders/${traderNameToSlug(trader.englishName)}/fir`}
          className="ml-auto text-xs text-sky-300 hover:underline"
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
        <span className="text-xs text-slate-500">{visibleTasks.length}件</span>
        {focusIds && (
          <button
            type="button"
            className="text-xs text-sky-300 hover:underline"
            onClick={() => {
              setFocus(null);
              onClearLinked();
            }}
          >
            絞り込み解除 ×
          </button>
        )}
      </div>
      <TaskTable
        tasks={visibleTasks}
        reputationTrader={trader.id}
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
