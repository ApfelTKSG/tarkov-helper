'use client';

import { useState } from 'react';
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
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import { taskRewardLabels } from '@/src/domain/task-presentation';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { matchesPrestige } from '@/src/domain/prestige';
import { taskVariantLabel } from '@/src/domain/task-variant';
import ApiImage from './ApiImage';
import CollectorBadge, { COLLECTOR_ID } from './CollectorBadge';

const control =
  'rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm disabled:opacity-40';
const number = (value: number) => value.toLocaleString('ja-JP', { maximumFractionDigits: 3 });

export default function TraderDashboard({
  trader,
  tasks,
  onSelect,
}: {
  trader: GameTrader;
  tasks: GameTask[];
  onSelect: (task: GameTask) => void;
}) {
  const { profile, snapshot, availability, edit, ready, storageError } = useGame();
  const [targetLevel, setTargetLevel] = useState<number>();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('available');
  const [sort, setSort] = useState('unlock');
  const [focus, setFocus] = useState<string[] | null>(null);
  const [limit, setLimit] = useState(24);
  const [showAllMilestones, setShowAllMilestones] = useState(false);
  const [lastCompleted, setLastCompleted] = useState<string>();
  if (!snapshot) return null;
  const disabled = !ready || !!storageError;
  const results = new Map(snapshot.tasks.map((task) => [task.id, availability(task)]));
  const evaluate = (task: GameTask) => results.get(task.id)!;
  const available = tasks.filter((task) => isActionable(task, profile, evaluate(task)));
  const goal = loyaltyGoal(trader, profile, available, targetLevel);
  const milestones = unlockMilestones(tasks, profile, evaluate).sort((first, second) => {
    const hasAvailable = (ids: string[]) =>
      snapshot.tasks.some(
        (task) =>
          ids.includes(task.id) &&
          matchesPrestige(task, profile.prestige) &&
          isActionable(task, profile, evaluate(task)),
      );
    return (
      Number(hasAvailable(second.taskIds)) - Number(hasAvailable(first.taskIds)) ||
      first.remaining - second.remaining
    );
  });
  const completed = tasks.filter((task) => profile.tasks[task.id] === 'complete').length;
  const uncertain = tasks.filter(
    (task) =>
      !['active', 'complete', 'failed'].includes(profile.tasks[task.id] ?? '') &&
      evaluate(task).state === 'unknown',
  ).length;
  const visibleTasks = (
    focus
      ? snapshot.tasks.filter(
          (task) => focus.includes(task.id) && matchesPrestige(task, profile.prestige),
        )
      : tasks
  )
    .filter(
      (task) =>
        (matchesTask(task, query, snapshot) ||
          (!!query.trim() &&
            snapshot.maps.some(
              (map) =>
                `${map.name} ${map.englishName}`
                  .normalize('NFKC')
                  .toLocaleLowerCase()
                  .includes(query.normalize('NFKC').trim().toLocaleLowerCase()) &&
                (task.map === map.id ||
                  task.objectives.some((objective) => objective.maps?.includes(map.id))),
            ))) &&
        (status === 'all' ||
          (status === 'available' && isActionable(task, profile, evaluate(task))) ||
          (status === 'locked' &&
            !['complete', 'failed'].includes(profile.tasks[task.id] ?? '') &&
            !isActionable(task, profile, evaluate(task))) ||
          (status === 'complete' && profile.tasks[task.id] === 'complete') ||
          (status === 'favorites' &&
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
      const first = taskUnlockImpact(a.id, milestones);
      const second = taskUnlockImpact(b.id, milestones);
      return (
        (first.nearest ?? Infinity) - (second.nearest ?? Infinity) ||
        second.count - first.count ||
        standingReward(b, trader.id) - standingReward(a, trader.id) ||
        a.name.localeCompare(b.name)
      );
    });
  const setReputation = (reputation: number | undefined) => {
    if (reputation !== undefined && !Number.isFinite(reputation)) return;
    edit((p) => ({
      ...p,
      traders: { ...p.traders, [trader.id]: { ...p.traders[trader.id], reputation } },
    }));
  };
  const showCandidates = (ids: string[]) => {
    setFocus(ids);
    setStatus(
      snapshot.tasks.some(
        (task) =>
          ids.includes(task.id) &&
          matchesPrestige(task, profile.prestige) &&
          isActionable(task, profile, evaluate(task)),
      )
        ? 'available'
        : 'locked',
    );
    setQuery('');
    setLimit(24);
  };

  return (
    <div className="space-y-7">
      <section
        aria-label="トレーダーの進捗"
        className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800/60"
      >
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.6fr] lg:p-7">
          <div>
            <div className="flex items-center gap-4">
              <ApiImage
                src={trader.imageLink}
                name={trader.name}
                className="h-20 w-20 rounded-xl object-cover"
              />
              <div>
                <p className="text-xs tracking-widest text-slate-400">現在の進捗</p>
                <p className="mt-1 text-3xl font-bold">
                  {goal.current.level === undefined
                    ? 'LL 未確定'
                    : goal.current.level === 0
                      ? '未解放'
                      : `LL ${goal.current.level}`}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  完了 {completed} / {tasks.length} · 今できる {available.length}件
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-sm text-slate-300">
                現在の信頼度
                <input
                  aria-label={`${trader.name} 現在の信頼度`}
                  className={`${control} w-32 text-lg font-semibold text-white`}
                  type="number"
                  step="0.01"
                  placeholder="未入力"
                  value={goal.current.reputation ?? ''}
                  disabled={disabled}
                  onChange={(event) =>
                    setReputation(
                      event.target.value === '' ? undefined : Number(event.target.value),
                    )
                  }
                />
              </label>
              <button
                type="button"
                aria-label="信頼度を0.01下げる"
                disabled={disabled}
                className={control}
                onClick={() =>
                  setReputation(Math.round(((goal.current.reputation ?? 0) - 0.01) * 1e8) / 1e8)
                }
              >
                −0.01
              </button>
              <button
                type="button"
                aria-label="信頼度を0.01上げる"
                disabled={disabled}
                className={control}
                onClick={() =>
                  setReputation(Math.round(((goal.current.reputation ?? 0) + 0.01) * 1e8) / 1e8)
                }
              >
                ＋0.01
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              タスク完了・失敗は自動反映。デイリーなどの変動はここで現在値に修正できます。
            </p>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              現在LLの指定
              <select
                aria-label={`${trader.name} 現在LLの指定`}
                className={control}
                disabled={disabled}
                value={profile.traders[trader.id]?.level ?? ''}
                onChange={(event) =>
                  edit((p) => ({
                    ...p,
                    traders: {
                      ...p.traders,
                      [trader.id]: {
                        ...p.traders[trader.id],
                        level: event.target.value === '' ? undefined : Number(event.target.value),
                      },
                    },
                  }))
                }
              >
                <option value="">自動判定</option>
                {trader.levels.map((level) => (
                  <option key={level.level} value={level.level}>
                    LL {level.level}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-xl border border-sky-900/70 bg-slate-950/50 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-sky-200">次のLLまで</h2>
              {trader.levels.length > 1 && (
                <select
                  aria-label="目標LL"
                  className={control}
                  value={targetLevel ?? ''}
                  onChange={(event) =>
                    setTargetLevel(
                      event.target.value === '' ? undefined : Number(event.target.value),
                    )
                  }
                >
                  <option value="">次のLLを目標にする</option>
                  {trader.levels
                    .filter((level) => level.level > 1)
                    .map((level) => (
                      <option key={level.level} value={level.level}>
                        LL {level.level}を目標にする
                      </option>
                    ))}
                </select>
              )}
            </div>
            {goal.target ? (
              <>
                <p className="mt-4 text-sm text-slate-300">目標 LL {goal.target.level}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {goal.reputationGap === undefined ? (
                    '信頼度を入力してください'
                  ) : goal.reputationGap === 0 ? (
                    '信頼度の条件を達成'
                  ) : (
                    <>
                      信頼度 あと <span className="text-sky-300">{number(goal.reputationGap)}</span>
                    </>
                  )}
                </p>
                <progress
                  aria-label="目標LLの信頼度進捗"
                  className="mt-4 h-2 w-full accent-sky-400"
                  max={Math.max(goal.target.requiredReputation, 0.01)}
                  value={Math.max(
                    0,
                    goal.reputationGap === 0
                      ? Math.max(goal.target.requiredReputation, 0.01)
                      : Math.min(
                          goal.current.reputation ?? 0,
                          Math.max(goal.target.requiredReputation, 0.01),
                        ),
                  )}
                />
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  <span
                    className={goal.reputationGap === 0 ? 'text-emerald-300' : 'text-slate-300'}
                  >
                    信頼度{' '}
                    {goal.current.reputation === undefined
                      ? '未入力'
                      : number(goal.current.reputation)}{' '}
                    / {number(goal.target.requiredReputation)}
                  </span>
                  <span
                    className={goal.playerLevelGap === 0 ? 'text-emerald-300' : 'text-amber-200'}
                  >
                    PMCレベル {profile.level ?? '未入力'} / {goal.target.requiredPlayerLevel}
                    {goal.playerLevelGap !== undefined &&
                      goal.playerLevelGap > 0 &&
                      `（あと${goal.playerLevelGap}）`}
                  </span>
                </div>
                <div className="mt-4 border-t border-slate-700 pt-3 text-sm">
                  {goal.minimumTasks !== undefined ? (
                    goal.minimumTasks === 0 ? (
                      <p className="text-emerald-300">
                        信頼度を増やす必要はありません。残りの条件を確認しましょう。
                      </p>
                    ) : (
                      <>
                        <p>
                          信頼度だけなら、今できるタスクから{' '}
                          <strong className="text-sky-200">{goal.minimumTasks}件</strong> が目安
                        </p>
                        <button
                          type="button"
                          className="mt-2 text-sky-300 underline underline-offset-4"
                          onClick={() => showCandidates(goal.plan.map((task) => task.id))}
                        >
                          候補をタスク一覧で見る →
                        </button>
                      </>
                    )
                  ) : (
                    <p className="text-slate-400">
                      {goal.reputationGap === undefined
                        ? '現在値を入力すると、必要なタスク数の目安を計算します。'
                        : `今できるタスクの信頼度報酬は合計 +${number(goal.availableReputation)}。不足分は追加の解放・デイリーなどが必要です。`}
                    </p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    件数はこのトレーダーの報酬が高い順の目安です。PMCレベル・トレーダー解放などは別条件です。取引額など未収録の条件はゲーム内で確認してください。
                  </p>
                </div>
              </>
            ) : (
              <p className="mt-6 text-slate-300">
                {goal.current.level !== undefined && trader.levels.length > 1
                  ? '収録されている最高LLに到達しています。次はタスクの解放を進めましょう。'
                  : 'このトレーダーの次のLL条件は収録されていません。'}
              </p>
            )}
            {!goal.current.unlocked && (
              <p className="mt-3 text-sm text-amber-300">
                先にトレーダー解放タスクの完了が必要です。
              </p>
            )}
          </div>
        </div>
      </section>

      <section aria-label="次のタスク解放">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold">あと何件で、次へ？</h2>
            <p className="mt-1 text-sm text-slate-400">
              今進められる対象がある目標から、残り件数順に表示します。
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {milestones.length}個の解放目標 · 要確認 {uncertain}タスク
          </span>
        </div>
        {milestones.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(showAllMilestones ? milestones : milestones.slice(0, 3)).map((milestone) => {
              const remainingIds = milestone.taskIds.filter(
                (id) => profile.tasks[id] !== 'complete',
              );
              const countAvailable = snapshot.tasks.filter(
                (task) =>
                  remainingIds.includes(task.id) &&
                  matchesPrestige(task, profile.prestige) &&
                  isActionable(task, profile, evaluate(task)),
              ).length;
              return (
                <article
                  key={milestone.key}
                  className="flex flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs text-slate-400">対象タスクの完了数</p>
                    <p className="text-xl font-bold text-amber-200">
                      あと {milestone.remaining} 件
                    </p>
                  </div>
                  <progress
                    className="mt-3 h-1.5 w-full accent-amber-300"
                    aria-label={`${milestone.targets[0].task.name} の完了数条件`}
                    value={milestone.completed}
                    max={milestone.required}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    {milestone.completed} / {milestone.required}件完了 · 今できる対象{' '}
                    {countAvailable}件
                  </p>
                  <div className="my-3 flex-1 space-y-2">
                    {milestone.targets.slice(0, 3).map(({ task, otherConditions }) => (
                      <div key={task.id}>
                        <button
                          type="button"
                          className="text-left text-sm font-semibold text-slate-100 hover:text-sky-300"
                          onClick={() => onSelect(task)}
                        >
                          {task.name}
                        </button>
                        {otherConditions && (
                          <p className="text-xs text-amber-300">
                            レベル・LLなど他の条件も残っています
                          </p>
                        )}
                      </div>
                    ))}
                    {milestone.targets.length > 3 && (
                      <details className="text-xs text-slate-400">
                        <summary className="cursor-pointer">
                          ほか{milestone.targets.length - 3}タスク
                        </summary>
                        <div className="mt-2 space-y-2">
                          {milestone.targets.slice(3).map(({ task, otherConditions }) => (
                            <div key={task.id}>
                              <button
                                type="button"
                                className="text-left text-sky-300"
                                onClick={() => onSelect(task)}
                              >
                                {task.name}
                              </button>
                              {otherConditions && <p>他の条件も残っています</p>}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <button
                    type="button"
                    className={`${control} w-full text-sky-200`}
                    onClick={() => showCandidates(remainingIds)}
                  >
                    対象タスクを選ぶ →
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-700 bg-slate-800/30 p-5 text-sm text-slate-400">
            現在、残り件数を確定できる解放目標はありません。LL・個別の前提・要確認の条件は、各タスクの詳細で確認できます。
          </p>
        )}
        {milestones.length > 3 && (
          <button
            type="button"
            className="mt-3 text-sm text-sky-300"
            onClick={() => setShowAllMilestones((value) => !value)}
          >
            {showAllMilestones
              ? '近い目標だけ表示'
              : `すべての解放目標を見る（${milestones.length}個）`}
          </button>
        )}
      </section>

      <section aria-label="進めるタスクを選ぶ" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-xl font-bold">どこから進める？</h2>
          <Link
            href={`/traders/${traderNameToSlug(trader.englishName)}/fir`}
            className="text-sm text-sky-300 hover:underline"
          >
            このトレーダーのFiRアイテム →
          </Link>
        </div>
        {focus && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-800 bg-sky-950/40 px-4 py-3 text-sm text-sky-200"
          >
            選んだ目標の対象タスクに絞っています。
            <button type="button" className="underline" onClick={() => setFocus(null)}>
              絞り込みを解除
            </button>
          </div>
        )}
        {lastCompleted && profile.tasks[lastCompleted] === 'complete' && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-800 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200"
          >
            <span>
              {snapshot.tasks.find((task) => task.id === lastCompleted)?.name}{' '}
              を完了として記録しました。
            </span>
            <button
              type="button"
              className="underline"
              disabled={disabled}
              onClick={() => {
                const task = snapshot.tasks.find((entry) => entry.id === lastCompleted);
                if (task && edit((p) => toggleTaskCompletion(p, task))) setLastCompleted(undefined);
              }}
            >
              取り消す
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            aria-label="タスク・アイテム検索"
            className={`${control} min-w-48 flex-1`}
            placeholder="タスク・アイテム・マップを検索"
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
            <option value="unlock">解放目標に近い順</option>
            <option value="reputation">信頼度報酬が高い順</option>
            <option value="level">要求レベルが低い順</option>
          </select>
        </div>
        <p className="text-xs text-slate-400">
          {visibleTasks.length}件 ·
          名前を押すと詳細、完了ボタンで記録。信頼度と解放までの件数は連動して更新します。
        </p>
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleTasks.slice(0, limit).map((task) => {
            const state = profile.tasks[task.id];
            const result = evaluate(task);
            const actionable = isActionable(task, profile, result);
            const reward = standingReward(task, trader.id);
            const impact = taskUnlockImpact(task.id, milestones);
            const rewards = taskRewardLabels(task);
            const maps = [
              ...new Set([
                ...(task.map ? [task.map] : []),
                ...task.objectives.flatMap((objective) => objective.maps ?? []),
              ]),
            ].map((id) => snapshot.maps.find((map) => map.id === id)?.name ?? id);
            return (
              <article
                key={task.id}
                aria-label={`${task.name} 進捗`}
                className={`rounded-xl border p-4 ${task.id === COLLECTOR_ID || (state !== 'complete' && profile.favorites.includes(task.id)) ? 'border-amber-400/70 bg-slate-800/60 ring-1 ring-amber-400/20' : state === 'complete' ? 'border-emerald-800 bg-emerald-950/20' : actionable ? 'border-slate-600 bg-slate-800/60' : result.state === 'unknown' ? 'border-amber-800 bg-amber-950/10' : 'border-slate-700 bg-slate-800/20'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 text-left"
                    onClick={() => onSelect(task)}
                  >
                    <span className="font-semibold hover:text-sky-300">{task.name}</span>
                    {task.id === COLLECTOR_ID && <CollectorBadge />}
                    <span className="mt-1 block text-xs text-slate-400">
                      {task.trader !== trader.id &&
                        `${snapshot.traders.find((entry) => entry.id === task.trader)?.name ?? ''} · `}
                      {maps.length ? maps.join(' / ') : 'マップ指定なし'}
                      {task.minPlayerLevel ? ` · レベル ${task.minPlayerLevel}～` : ''}
                    </span>
                    {taskVariantLabel(task, snapshot.tasks) && (
                      <span className="mt-1 block text-xs text-sky-300">
                        {taskVariantLabel(task, snapshot.tasks)}
                      </span>
                    )}
                  </button>
                  <span
                    className={`shrink-0 rounded-lg px-2 py-1 text-sm font-semibold ${reward > 0 ? 'bg-emerald-950 text-emerald-300' : reward < 0 ? 'bg-red-950 text-red-300' : 'text-slate-500'}`}
                  >
                    {reward > 0 ? '+' : ''}
                    {number(reward)} <span className="text-[10px] font-normal">信頼度</span>
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>{rewards.experience}</span>
                  <span>{rewards.money}</span>
                  {impact.count > 0 && (
                    <span className="text-amber-200">{impact.count}タスクの解放カウントに貢献</span>
                  )}
                </div>
                {!actionable && state !== 'complete' && (
                  <p className="mt-2 text-xs text-amber-300">
                    {state === 'failed'
                      ? '失敗を記録済み'
                      : result.state === 'unknown'
                        ? '要確認：ゲーム内に出ているか詳細で指定'
                        : '条件未達：詳細で不足条件を確認'}
                  </p>
                )}
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-700/70 pt-3">
                  <button
                    type="button"
                    disabled={disabled || state === 'complete'}
                    aria-label={`${task.name} お気に入り`}
                    aria-pressed={profile.favorites.includes(task.id) && state !== 'complete'}
                    className="text-sm text-amber-300 disabled:opacity-30"
                    onClick={() =>
                      edit((p) => ({
                        ...p,
                        favorites: p.favorites.includes(task.id)
                          ? p.favorites.filter((id) => id !== task.id)
                          : [...p.favorites, task.id],
                      }))
                    }
                  >
                    {profile.favorites.includes(task.id) && state !== 'complete'
                      ? '★ お気に入り'
                      : '☆'}
                  </button>
                  <div className="flex gap-2">
                    <button type="button" className={control} onClick={() => onSelect(task)}>
                      詳細
                    </button>
                    <button
                      type="button"
                      aria-label={`${task.name} ${state === 'complete' ? '完了を取り消す' : '完了する'}`}
                      disabled={disabled || (!actionable && state !== 'complete')}
                      className={`${control} ${state === 'complete' ? 'text-emerald-300' : 'border-emerald-700 text-emerald-200'}`}
                      onClick={() => {
                        if (edit((p) => toggleTaskCompletion(p, task)))
                          setLastCompleted(state === 'complete' ? undefined : task.id);
                      }}
                    >
                      {state === 'complete' ? '完了を取り消す' : '完了する'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {!visibleTasks.length && (
          <p className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            該当するタスクはありません。状態の絞り込みを変えるか、PMCレベル・信頼度・LLを確認してください。
          </p>
        )}
        {visibleTasks.length > limit && (
          <button type="button" className={control} onClick={() => setLimit((value) => value + 24)}>
            さらに24件表示
          </button>
        )}
      </section>
    </div>
  );
}
