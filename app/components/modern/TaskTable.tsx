'use client';
import { Fragment, useState } from 'react';
import Link from 'next/link';
import type { GameTask } from '@/src/domain/game';
import { useGame } from '@/app/context/GameContext';
import { isActionable, standingReward } from '@/src/domain/trader-dashboard';
import { taskSummary } from '@/src/domain/task-row';
import { taskMapIds } from '@/src/domain/maps';
import { lockedGroups, taskLock, compareLockRank, compareTaskMaps } from '@/src/domain/task-groups';
import { setTaskAvailability, type TaskAvailabilityChoice } from '@/src/domain/task-availability';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { taskVariantLabel } from '@/src/domain/task-variant';
import { COLLECTOR_ID } from './CollectorBadge';
import ApiImage from './ApiImage';
import TaskFirPopover from './TaskFirPopover';
const number = (value: number) => value.toLocaleString('ja-JP', { maximumFractionDigits: 3 });
export default function TaskTable({
  tasks,
  reputationTrader,
  onComplete,
  onSaved,
  showTrader = false,
  highlightedTaskIds = [],
}: {
  tasks: GameTask[];
  reputationTrader?: string;
  onComplete: (task: GameTask) => void;
  onSaved: (message: string) => void;
  showTrader?: boolean;
  highlightedTaskIds?: string[];
}) {
  const { profile, snapshot, availability, edit, ready, storageError } = useGame();
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const [columnSort, setColumnSort] = useState<{
    key: 'map' | 'reputation';
    direction: 1 | -1;
  } | null>(null);
  if (!snapshot) return null;
  const disabled = !ready || !!storageError;
  const toggleSort = (key: 'map' | 'reputation') =>
    setColumnSort((current) =>
      current?.key === key && current.direction === -1
        ? null
        : {
            key,
            direction: current?.key === key && current.direction === 1 ? -1 : 1,
          },
    );
  const compareColumn = (a: GameTask, b: GameTask) =>
    !columnSort
      ? 0
      : columnSort.direction *
        (columnSort.key === 'map'
          ? compareTaskMaps(a, b, snapshot)
          : standingReward(a, reputationTrader ?? a.trader) -
            standingReward(b, reputationTrader ?? b.trader));
  const locks = new Map(
    tasks.map((task) => [task.id, taskLock(task, profile, availability(task), snapshot)]),
  );
  const sections = [
    {
      id: 'available',
      label: '',
      tasks: tasks
        .filter((task) => !locks.get(task.id) && profile.tasks[task.id] !== 'complete')
        .sort(compareColumn),
    },
    ...lockedGroups.map(([id, label]) => ({
      id,
      label,
      tasks: tasks
        .filter((task) => locks.get(task.id)?.group === id)
        .sort(
          (a, b) =>
            compareLockRank(locks.get(a.id)!.rank, locks.get(b.id)!.rank) ||
            a.name.localeCompare(b.name),
        ),
    })),
    {
      id: 'complete',
      label: 'クリア済み',
      tasks: tasks.filter((task) => profile.tasks[task.id] === 'complete'),
    },
  ].filter((section) => section.tasks.length);
  const renderTask = (task: GameTask) => {
    const state = profile.tasks[task.id],
      complete = state === 'complete';
    const result = availability(task),
      actionable = isActionable(task, profile, result);
    const reward = standingReward(task, reputationTrader ?? task.trader);
    const summary = taskSummary(task);
    const manualConfirmation =
      result.conditions.some((condition) => condition.state === 'unknown') &&
      !result.conditions.some((condition) => condition.state === 'unmet');
    const variant = taskVariantLabel(task, snapshot.tasks);
    const mapNames = taskMapIds(task)
      .map((id) => snapshot.maps.find((map) => map.id === id)?.name ?? id)
      .join(' / ');
    const lock = taskLock(task, profile, result, snapshot);
    const levelLabel = lock && task.minPlayerLevel ? `レベル ${task.minPlayerLevel}～` : '';
    const metadata = [variant, levelLabel, lock?.hint !== levelLabel ? lock?.hint : '']
      .filter(Boolean)
      .join(' · ');
    return (
      <Fragment key={task.id}>
        <tr
          id={`task-${task.id}`}
          aria-label={`${task.name} 進捗`}
          data-state={complete ? 'complete' : !actionable ? 'locked' : 'available'}
          data-highlighted={!complete && highlightedTaskIds.includes(task.id) ? 'true' : undefined}
          className={`ui-task-row align-middle ${task.id === COLLECTOR_ID ? 'ring-1 ring-inset ring-amber-400/40' : ''}`}
        >
          <td className="px-3 py-2.5">
            <input
              type="checkbox"
              aria-label={`${task.name} ${complete ? '完了を取り消す' : '完了を記録'}`}
              className="h-4 w-4 accent-emerald-400 disabled:opacity-30"
              checked={complete}
              disabled={disabled || (!actionable && !complete)}
              onChange={() => onComplete(task)}
            />
          </td>
          <td className="px-3 py-2.5">
            <div className="flex items-start gap-2">
              {showTrader && (
                <Link
                  href={`/traders/${traderNameToSlug(snapshot.traders.find((t) => t.id === task.trader)?.englishName ?? '')}`}
                  title={snapshot.traders.find((t) => t.id === task.trader)?.name}
                  aria-label={snapshot.traders.find((t) => t.id === task.trader)?.name}
                >
                  <ApiImage
                    src={snapshot.traders.find((t) => t.id === task.trader)?.imageLink}
                    name={snapshot.traders.find((t) => t.id === task.trader)?.name ?? ''}
                    className="h-7 w-7 shrink-0 rounded object-cover"
                  />
                </Link>
              )}
              <button
                type="button"
                aria-label={`${task.name} お気に入り`}
                aria-pressed={profile.favorites.includes(task.id) && !complete}
                disabled={disabled || complete}
                className={`shrink-0 ${profile.favorites.includes(task.id) ? 'text-amber-300' : 'text-slate-500 hover:text-slate-200'} disabled:opacity-20`}
                onClick={() => {
                  if (
                    edit((p) => ({
                      ...p,
                      favorites: p.favorites.includes(task.id)
                        ? p.favorites.filter((id) => id !== task.id)
                        : [...p.favorites, task.id],
                    }))
                  )
                    onSaved('お気に入りを保存しました');
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
                {metadata && (
                  <p className="mt-1 truncate text-xs text-slate-400" title={metadata}>
                    {metadata}
                  </p>
                )}
              </div>
            </div>
          </td>
          <td className="px-3 py-2.5 text-[13px] text-slate-400">
            <p className="line-clamp-2" title={mapNames}>
              {mapNames || '—'}
            </p>
          </td>
          <td className="px-3 py-2.5">
            <p className="truncate text-[13px] text-slate-400" title={summary}>
              {summary || '概要はWikiで確認'}
            </p>
          </td>
          <td className="px-3 py-2.5">
            <TaskFirPopover task={task} onSaved={onSaved} />
          </td>
          <td
            className={`px-3 py-2.5 text-right text-[13px] tabular-nums ${reward < 0 ? 'text-red-300' : reward === 0 ? 'text-slate-500' : 'text-slate-200'}`}
          >
            {reward > 0 ? '+' : ''}
            {number(reward)}
          </td>
          <td className="px-3 py-2.5 text-right">
            {task.wikiLink && (
              <a
                href={task.wikiLink}
                target="_blank"
                rel="noreferrer"
                className="ui-link text-xs hover:underline"
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
                    manualConfirmation ? 'ゲーム内に出ているかを記録' : '条件を自動判定するか指定'
                  }
                  className="mt-1 block w-full rounded border border-transparent bg-transparent px-1 py-1 text-xs hover:border-slate-700 hover:bg-slate-800 text-slate-400 disabled:opacity-40"
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
                        setTaskAvailability(p, task, event.target.value as TaskAvailabilityChoice),
                      )
                    )
                      onSaved('受注状態を保存しました');
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
      </Fragment>
    );
  };
  return (
    <div
      role="region"
      aria-label="タスク行（スクロール）"
      tabIndex={0}
      className="min-h-0 flex-1 overflow-auto overscroll-contain border-t border-slate-700 [scrollbar-gutter:stable]"
    >
      <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
        <colgroup>
          <col className="w-12" />
          <col className="w-[23%]" />
          <col className="w-28" />
          <col />
          <col className="w-40" />
          <col className="w-20" />
          <col className="w-32" />
        </colgroup>
        <thead className="sticky top-0 z-10 bg-slate-900 text-xs text-slate-400">
          <tr>
            <th className="px-3 py-2.5">
              <span className="sr-only">完了</span>
            </th>
            <th className="px-3 py-2.5 font-normal">タスク</th>
            <th
              className="p-0 font-normal"
              aria-sort={
                columnSort?.key === 'map'
                  ? columnSort.direction === 1
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                className="block h-full w-full px-3 py-2.5 text-left hover:bg-slate-800 hover:text-slate-100"
                title="受注可能なタスクだけを昇順・降順・標準順に切り替え"
                onClick={() => toggleSort('map')}
              >
                Map {columnSort?.key === 'map' ? (columnSort.direction === 1 ? '↑' : '↓') : '↕'}
              </button>
            </th>
            <th className="px-3 py-2.5 font-normal">概要</th>
            <th className="px-3 py-2.5 font-normal">FiR</th>
            <th
              className="p-0 text-right font-normal"
              aria-sort={
                columnSort?.key === 'reputation'
                  ? columnSort.direction === 1
                    ? 'ascending'
                    : 'descending'
                  : 'none'
              }
            >
              <button
                type="button"
                className="block h-full w-full px-3 py-2.5 text-right hover:bg-slate-800 hover:text-slate-100"
                title="受注可能なタスクだけを昇順・降順・標準順に切り替え"
                onClick={() => toggleSort('reputation')}
              >
                信頼度{' '}
                {columnSort?.key === 'reputation' ? (columnSort.direction === 1 ? '↑' : '↓') : '↕'}
              </button>
            </th>
            <th className="px-3 py-2.5 text-right font-normal">Wiki・受注</th>
          </tr>
        </thead>
        {sections.map((section) => (
          <Fragment key={section.id}>
            <tbody>
              {section.id !== 'available' && (
                <tr
                  className="ui-task-group"
                  data-state={section.id === 'complete' ? 'complete' : 'locked'}
                  data-highlighted={
                    section.tasks.some((task) => highlightedTaskIds.includes(task.id))
                      ? 'true'
                      : undefined
                  }
                >
                  <td colSpan={7} className="p-0">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] hover:brightness-125"
                      aria-expanded={openGroups.includes(section.id)}
                      aria-controls={`group-${section.id}`}
                      onClick={() =>
                        setOpenGroups((ids) =>
                          ids.includes(section.id)
                            ? ids.filter((id) => id !== section.id)
                            : [...ids, section.id],
                        )
                      }
                    >
                      <span aria-hidden="true">{openGroups.includes(section.id) ? '▾' : '▸'}</span>
                      {section.label}
                      <span className="text-xs opacity-70">{section.tasks.length}件</span>
                      {section.tasks.some((task) => highlightedTaskIds.includes(task.id)) && (
                        <span className="ml-2 text-xs text-slate-100">
                          強調対象{' '}
                          {
                            section.tasks.filter((task) => highlightedTaskIds.includes(task.id))
                              .length
                          }
                          件
                        </span>
                      )}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
            <tbody
              id={`group-${section.id}`}
              hidden={section.id !== 'available' && !openGroups.includes(section.id)}
              className="divide-y divide-slate-800"
            >
              {(section.id === 'available' || openGroups.includes(section.id)) &&
                section.tasks.map(renderTask)}
            </tbody>
          </Fragment>
        ))}
        <tbody>
          {!tasks.length && (
            <tr>
              <td colSpan={7} className="p-10 text-center text-sm text-slate-500">
                該当するタスクはありません。
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
