'use client';

import { Fragment, useCallback, useRef, useState } from 'react';
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
import { taskFirEntries, taskSummary } from '@/src/domain/task-row';
import { matchesTask } from '@/src/domain/task-view';
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import { setTaskAvailability, type TaskAvailabilityChoice } from '@/src/domain/task-availability';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { matchesPrestige } from '@/src/domain/prestige';
import { taskVariantLabel } from '@/src/domain/task-variant';
import { COLLECTOR_ID } from './CollectorBadge';
import ApiImage from './ApiImage';
import ItemCounter from './ItemCounter';
import Toast from './Toast';

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
  const [status, setStatus] = useState('available');
  const [sort, setSort] = useState('unlock');
  const [focus, setFocus] = useState<string[] | null>(null);
  const [expandedFir, setExpandedFir] = useState<string>();
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
  const effectiveStatus = !focus && linkedTask ? 'all' : status;
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
        (matchesTask(task, query, snapshot) ||
          (!!needle &&
            snapshot.maps.some(
              (map) =>
                `${map.name} ${map.englishName}`
                  .normalize('NFKC')
                  .toLocaleLowerCase()
                  .includes(needle) &&
                (task.map === map.id ||
                  task.objectives.some((objective) => objective.maps?.includes(map.id))),
            ))) &&
        (effectiveStatus === 'all' ||
          (effectiveStatus === 'available' && isActionable(task, profile, evaluate(task))) ||
          (effectiveStatus === 'locked' &&
            !['complete', 'failed'].includes(profile.tasks[task.id] ?? '') &&
            !isActionable(task, profile, evaluate(task))) ||
          (effectiveStatus === 'complete' && profile.tasks[task.id] === 'complete') ||
          (effectiveStatus === 'favorites' &&
            profile.tasks[task.id] !== 'complete' &&
            profile.favorites.includes(task.id))),
    )
    .sort((a, b) => {
      if (sort === 'reputation')
        return (
          standingReward(b, trader.id) - standingReward(a, trader.id) ||
          a.name.localeCompare(b.name)
        );
      if (sort === 'level')
        return (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0) || a.name.localeCompare(b.name);
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
    setStatus(hasAvailable(ids) ? 'available' : 'locked');
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
        <select
          aria-label="タスクの状態"
          className={control}
          value={effectiveStatus}
          onChange={(event) => {
            if (linkedTask) {
              setFocus(focusIds);
              onClearLinked();
            }
            setStatus(event.target.value);
          }}
        >
          <option value="available">今できる</option>
          <option value="locked">解放待ち・要確認</option>
          <option value="complete">完了</option>
          <option value="favorites">お気に入り</option>
          <option value="all">すべて</option>
        </select>
        <select
          aria-label="タスクの並び順"
          className={control}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="unlock">解放に近い順</option>
          <option value="reputation">信頼度順</option>
          <option value="level">要求レベル順</option>
        </select>
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
      <div
        role="region"
        aria-label="タスク行（スクロール）"
        tabIndex={0}
        className="min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-slate-700 [scrollbar-gutter:stable]"
      >
        <table className="w-full min-w-[720px] table-fixed text-left text-sm">
          <colgroup>
            <col className="w-12" />
            <col className="w-[28%]" />
            <col />
            <col className="w-20" />
            <col className="w-32" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-slate-800 text-xs text-slate-400">
            <tr>
              <th className="px-3 py-3">
                <span className="sr-only">完了</span>
              </th>
              <th className="px-3 py-3 font-normal">タスク</th>
              <th className="px-3 py-3 font-normal">概要・FiR</th>
              <th className="px-3 py-3 text-right font-normal">信頼度</th>
              <th className="px-3 py-3 text-right font-normal">Wiki・受注</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {visibleTasks.map((task) => {
              const state = profile.tasks[task.id],
                complete = state === 'complete';
              const result = evaluate(task),
                actionable = isActionable(task, profile, result);
              const reward = standingReward(task, trader.id);
              const fir = taskFirEntries(task, profile.objectiveCounts);
              const firValue = fir.reduce((sum, entry) => sum + entry.value, 0),
                firMaximum = fir.reduce((sum, entry) => sum + (entry.maximum ?? 0), 0);
              const unknownQuantity = fir.some((entry) => entry.maximum === undefined);
              const previewItems = [...new Set(fir.flatMap((entry) => entry.items))];
              const summary = taskSummary(task);
              const manualConfirmation =
                result.conditions.some((condition) => condition.state === 'unknown') &&
                !result.conditions.some((condition) => condition.state === 'unmet');
              const variant = taskVariantLabel(task, snapshot.tasks);
              return (
                <Fragment key={task.id}>
                  <tr
                    id={`task-${task.id}`}
                    aria-label={`${task.name} 進捗`}
                    className={`h-20 align-middle ${complete ? 'bg-emerald-950/15' : 'hover:bg-slate-800/40'} ${task.id === COLLECTOR_ID ? 'bg-amber-950/15' : ''}`}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`${task.name} ${complete ? '完了を取り消す' : '完了を記録'}`}
                        className="h-4 w-4 accent-emerald-400 disabled:opacity-30"
                        checked={complete}
                        disabled={disabled || (!actionable && !complete)}
                        onChange={() => markComplete(task)}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          aria-label={`${task.name} お気に入り`}
                          aria-pressed={profile.favorites.includes(task.id) && !complete}
                          disabled={disabled || complete}
                          className="shrink-0 text-amber-300 disabled:opacity-20"
                          onClick={() => {
                            if (
                              edit((p) => ({
                                ...p,
                                favorites: p.favorites.includes(task.id)
                                  ? p.favorites.filter((id) => id !== task.id)
                                  : [...p.favorites, task.id],
                              }))
                            )
                              notify('お気に入りを保存しました');
                          }}
                        >
                          {profile.favorites.includes(task.id) && !complete ? '★' : '☆'}
                        </button>
                        <div className="min-w-0">
                          <p
                            title={task.name}
                            className={`line-clamp-2 font-medium ${complete ? 'text-emerald-300' : actionable ? 'text-slate-100' : 'text-slate-400'}`}
                          >
                            {task.name}
                            {task.id === COLLECTOR_ID && (
                              <span className="ml-2 text-[10px] text-amber-300">Kappa</span>
                            )}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500">
                            {task.trader !== trader.id &&
                              `${snapshot.traders.find((entry) => entry.id === task.trader)?.name ?? ''} · `}
                            {variant || (task.minPlayerLevel ? `Lv.${task.minPlayerLevel}～` : '')}
                            {!actionable && !complete && (
                              <span className={result.state === 'unknown' ? 'text-amber-300' : ''}>
                                {variant || task.minPlayerLevel ? ' · ' : ''}
                                {state === 'failed'
                                  ? '失敗'
                                  : result.state === 'unknown'
                                    ? '要確認'
                                    : '条件未達'}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <p className="truncate text-xs text-slate-400" title={summary}>
                        {summary || '概要はWikiで確認'}
                      </p>
                      {fir.length > 0 && (
                        <button
                          type="button"
                          aria-label={`${task.name} FiR確保数`}
                          aria-expanded={expandedFir === task.id}
                          aria-controls={`fir-${task.id}`}
                          className="mt-1 flex max-w-full items-center gap-1.5 rounded hover:bg-slate-700/40"
                          onClick={() =>
                            setExpandedFir(expandedFir === task.id ? undefined : task.id)
                          }
                        >
                          {previewItems.slice(0, 3).map((id) => (
                            <ApiImage
                              key={id}
                              src={snapshot.items[id]?.iconLink}
                              name={snapshot.items[id]?.name ?? id}
                              className="h-6 w-6 rounded object-contain"
                            />
                          ))}
                          <span
                            className={`text-[11px] ${firValue === firMaximum && !unknownQuantity ? 'text-emerald-300' : 'text-slate-400'}`}
                          >
                            FiR{' '}
                            {complete
                              ? '完了'
                              : firMaximum === 0 && unknownQuantity
                                ? '数量要確認'
                                : `${firValue}/${firMaximum}${unknownQuantity ? '＋要確認' : ''}`}{' '}
                            {previewItems.length > 3 ? `ほか${previewItems.length - 3}` : ''}{' '}
                            {expandedFir === task.id ? '▴' : '▾'}
                          </span>
                        </button>
                      )}
                    </td>
                    <td
                      className={`px-3 py-3 text-right text-xs tabular-nums ${reward > 0 ? 'text-emerald-300' : reward < 0 ? 'text-red-300' : 'text-slate-500'}`}
                    >
                      {reward > 0 ? '+' : ''}
                      {number(reward)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {task.wikiLink && (
                        <a
                          href={task.wikiLink}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-sky-300 hover:underline"
                          aria-label={`${task.name} Wikiを開く`}
                        >
                          Wiki ↗
                        </a>
                      )}
                      {!complete &&
                        (result.state !== 'eligible' ||
                          profile.taskAvailabilityOverrides?.[task.id] === 'available') && (
                          <select
                            aria-label={`${task.name} ${manualConfirmation ? 'ゲーム内の表示' : '受注条件'}`}
                            title={
                              manualConfirmation
                                ? 'ゲーム内に出ているかを記録'
                                : '条件を自動判定するか指定'
                            }
                            className="mt-1 block w-full rounded border border-slate-700 bg-slate-900 px-1 py-1 text-[11px] text-slate-400 disabled:opacity-40"
                            disabled={disabled}
                            value={
                              profile.taskAvailabilityOverrides?.[task.id] === 'available' ||
                              (state === 'active' && result.state !== 'eligible')
                                ? 'available'
                                : 'automatic'
                            }
                            onChange={(event) => {
                              if (
                                edit((p) =>
                                  setTaskAvailability(
                                    p,
                                    task,
                                    event.target.value as TaskAvailabilityChoice,
                                  ),
                                )
                              )
                                notify('受注状態を保存しました');
                            }}
                          >
                            <option value="automatic">
                              {manualConfirmation ? '出ていない' : '自動判定'}
                            </option>
                            <option value="available">
                              {manualConfirmation ? '出ている' : '条件を無視'}
                            </option>
                          </select>
                        )}
                    </td>
                  </tr>
                  {expandedFir === task.id && (
                    <tr id={`fir-${task.id}`}>
                      <td
                        colSpan={5}
                        className="border-t border-slate-800 bg-slate-950/50 px-5 py-4"
                      >
                        <div className="flex flex-wrap items-start gap-5">
                          {fir.map((entry) => (
                            <div key={entry.id} className="max-w-sm">
                              <p className="mb-2 text-xs text-slate-400">{entry.description}</p>
                              {entry.maximum !== undefined && entry.items.length > 0 ? (
                                <ItemCounter
                                  compact
                                  items={entry.items}
                                  label={`${task.name} ${entry.description}`}
                                  value={entry.value}
                                  maximum={entry.maximum}
                                  disabled={disabled || complete}
                                  onChange={(value) => {
                                    if (
                                      edit((p) => ({
                                        ...p,
                                        objectiveCounts: {
                                          ...p.objectiveCounts,
                                          [entry.key]: value,
                                        },
                                      }))
                                    )
                                      notify(`FiRを記録しました：${value}/${entry.maximum}`);
                                  }}
                                />
                              ) : (
                                <p className="text-xs text-slate-500">数量・候補はWikiで確認</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!visibleTasks.length && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-sm text-slate-500">
                  該当するタスクはありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
