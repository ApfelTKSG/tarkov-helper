'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import type { GameTask, Objective } from '@/src/domain/game';
import type { TaskState } from '@/src/domain/progression';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { changeTaskState, reputationRewards } from '@/src/domain/task-reputation';
import { taskLoyaltyPlacement } from '@/src/domain/task-columns';
import CollectorBadge, { COLLECTOR_ID } from './CollectorBadge';
import { taskVariantLabel } from '@/src/domain/task-variant';
import { taskGraphStatus } from '@/src/domain/task-presentation';
import { setTaskAvailability, type TaskAvailabilityChoice } from '@/src/domain/task-availability';

export const stateNames: Record<TaskState, string> = {
  unstarted: '未受注',
  active: '受注中',
  complete: '完了',
  failed: '失敗',
};
export const availabilityNames = {
  eligible: '条件を満たす',
  blocked: '条件未達',
  unknown: '要確認',
};
const control = 'rounded border border-slate-600 bg-slate-900 px-2 py-1';

export function ObjectiveProgress({ taskId, objective }: { taskId: string; objective: Objective }) {
  const { profile, edit, snapshot, storageError } = useGame();
  const key = `${taskId}:${objective.id}`;
  const maximum = objective.count ?? 1;
  const count = Math.min(profile.objectiveCounts[key] ?? 0, maximum);
  const candidates = objective.item ? [objective.item] : (objective.items ?? []);
  return (
    <div className="space-y-1 rounded bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className={count >= maximum ? 'text-slate-400 line-through' : ''}>
          {objective.description}{' '}
          {objective.optional && <span className="text-amber-400">（任意）</span>}
        </p>
        <label className="flex shrink-0 items-center gap-1 text-sm">
          <input
            aria-label={`${objective.description} 達成数`}
            className={`${control} w-20`}
            type="number"
            min="0"
            max={maximum}
            step="1"
            value={count}
            disabled={!!storageError}
            onChange={(e) => {
              const value = Number(e.target.value);
              if (Number.isInteger(value) && value >= 0 && value <= maximum)
                edit((p) => ({ ...p, objectiveCounts: { ...p.objectiveCounts, [key]: value } }));
            }}
          />{' '}
          / {maximum}
        </label>
      </div>
      {!!candidates.length && (
        <p className="text-sm text-slate-300">
          {objective.foundInRaid ? 'FiR必須 · ' : ''}
          {candidates.length > 1 ? 'いずれかの候補を合計して達成: ' : ''}
          {candidates.map((id) => snapshot?.items[id]?.name ?? id).join(' / ')}
        </p>
      )}
    </div>
  );
}
export default function TaskPanel({ task }: { task: GameTask }) {
  const { profile, snapshot, edit, availability, storageError } = useGame();
  const result = availability(task);
  const favorite = profile.tasks[task.id] !== 'complete' && profile.favorites.includes(task.id);
  const taskState = profile.tasks[task.id] ?? 'unstarted';
  const presentation = taskGraphStatus(taskState, result.state);
  const placement = taskLoyaltyPlacement(task, snapshot?.tasks ?? []);
  const resolveName = (reference?: string) =>
    snapshot?.tasks.find((t) => t.id === reference)?.name ??
    snapshot?.traders.find((t) => t.id === reference)?.name ??
    '';
  return (
    <article
      id={`task-${task.id}`}
      className={`scroll-mt-4 rounded-xl border p-4 ${task.id === COLLECTOR_ID ? 'ring-2 ring-amber-400/60' : ''}`}
      style={{ background: presentation.background, borderColor: presentation.borderColor }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">
            {task.name} {task.id === COLLECTOR_ID && <CollectorBadge />}
          </h3>
          {taskVariantLabel(task, snapshot?.tasks ?? []) && (
            <p className="text-sm text-sky-200">{taskVariantLabel(task, snapshot?.tasks ?? [])}</p>
          )}
          {task.name !== task.englishName && (
            <p className="text-sm text-slate-400">{task.englishName}</p>
          )}
          <p className="text-xs text-slate-400">
            {snapshot?.traders.find((t) => t.id === task.trader)?.name} · {task.experience ?? 0} XP
            · {task.id}
          </p>
          {task.supplementLoyaltyLevel && (
            <p className="text-xs text-slate-400">
              補足データの分類: LL{task.supplementLoyaltyLevel}（受注判定は下の解放条件で確認）
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={`${task.name} お気に入り`}
            aria-pressed={favorite}
            className={`${control} ${favorite ? 'text-amber-300' : ''}`}
            disabled={!!storageError || taskState === 'complete'}
            onClick={() =>
              edit((p) => ({
                ...p,
                favorites: p.favorites.includes(task.id)
                  ? p.favorites.filter((id) => id !== task.id)
                  : [...p.favorites, task.id],
              }))
            }
          >
            {favorite ? '★' : '☆'}
          </button>
          {taskState === 'unstarted' && result.state !== 'eligible' ? (
            <span className="text-sm text-slate-400">
              {result.state === 'blocked' ? '受けられない' : '条件未確認'}
            </span>
          ) : (
            <select
              aria-label={`${task.name} 状態`}
              className={control}
              value={taskState === 'unstarted' ? 'active' : taskState}
              disabled={!!storageError}
              onChange={(e) => edit((p) => changeTaskState(p, task, e.target.value as TaskState))}
            >
              {Object.entries(stateNames)
                .filter(([state]) => state !== 'unstarted')
                .map(([state, name]) => (
                  <option key={state} value={state}>
                    {name}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>
      {!!placement.inheritedFrom.length && (
        <p className="mt-3 text-sm text-sky-200">
          LL{placement.level}に分類：前提タスク{' '}
          {placement.inheritedFrom.map((source) => resolveName(source.id)).join(' / ')}{' '}
          のLLから分類しています。
          前提がすでに完了している場合の受注可否は、下の解放条件で判定します。
        </p>
      )}
      <p className="mt-3 text-xs text-slate-300">
        信頼度（完了）:{' '}
        {Object.entries(reputationRewards(task, 'complete'))
          .map(([id, amount]) => `${resolveName(id) || id} ${amount >= 0 ? '+' : ''}${amount}`)
          .join(' / ') || '変動なし'}
        {' · '}失敗:{' '}
        {Object.entries(reputationRewards(task, 'failed'))
          .map(([id, amount]) => `${resolveName(id) || id} ${amount >= 0 ? '+' : ''}${amount}`)
          .join(' / ') || '変動なし'}
        {' · '}状態変更時に自動反映。取り消すと反映分を戻します。
      </p>
      <div className="my-3 flex flex-wrap items-center gap-3 text-sm">
        {result.state !== 'eligible' && (
          <span
            className={`rounded px-2 py-1 ${result.state === 'blocked' ? 'bg-red-950 text-red-200' : 'bg-amber-950 text-amber-200'}`}
          >
            {availabilityNames[result.state]}
          </span>
        )}
        <label className="flex flex-wrap items-center gap-2">
          受注条件
          <select
            aria-label={`${task.name} 受注条件`}
            className={control}
            value={
              profile.taskAvailabilityOverrides?.[task.id] === 'available'
                ? 'available'
                : 'automatic'
            }
            disabled={!!storageError}
            onChange={(e) =>
              edit((p) => setTaskAvailability(p, task, e.target.value as TaskAvailabilityChoice))
            }
          >
            <option value="automatic">条件自動判定</option>
            <option value="available">条件を無視して受注可能にする</option>
          </select>
        </label>
        <p className="w-full text-xs text-slate-300">
          条件自動判定では、条件未達・未確認のタスクを半透明にします。条件を無視すると受注可能になります。切り替えると現在の完了・失敗・受注記録を解除します。受注可能にしても完了にはなりません。
        </p>
        {task.wikiLink && (
          <a
            className="text-sky-300 hover:underline"
            href={task.wikiLink}
            target="_blank"
            rel="noreferrer"
          >
            Wiki ↗
          </a>
        )}
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-slate-300">
          解放条件・不足理由 ({result.conditions.filter((c) => c.state !== 'met').length}件)
        </summary>
        <ul className="my-2 space-y-2 text-sm">
          {result.conditions.map((condition, index) => {
            const referenced = snapshot?.tasks.find((t) => t.id === condition.reference);
            const trader = referenced && snapshot?.traders.find((t) => t.id === referenced.trader);
            const opaque = ['globalVariable', 'dialogue'].includes(condition.kind);
            return (
              <li
                key={index}
                className={
                  condition.state === 'met'
                    ? 'text-emerald-300'
                    : condition.state === 'unmet'
                      ? 'text-red-300'
                      : 'text-amber-300'
                }
              >
                {condition.state === 'met' ? '✓' : condition.state === 'unmet' ? '×' : '?'}{' '}
                {resolveName(condition.reference)} {condition.message}
                {referenced && trader && (
                  <Link
                    className="ml-2 text-sky-300 underline"
                    href={`/traders/${traderNameToSlug(trader.englishName)}#task-${referenced.id}`}
                  >
                    前提を見る
                  </Link>
                )}
                {opaque && condition.reference && (
                  <select
                    aria-label={`${task.name} ${condition.kind} 確認`}
                    className={`${control} ml-2 text-white`}
                    value={
                      profile.confirmedRequirements?.[condition.reference] === undefined
                        ? ''
                        : String(profile.confirmedRequirements[condition.reference])
                    }
                    disabled={!!storageError}
                    onChange={(e) =>
                      edit((p) => ({
                        ...p,
                        confirmedRequirements: {
                          ...p.confirmedRequirements,
                          [condition.reference!]:
                            e.target.value === '' ? undefined : e.target.value === 'true',
                        } as Record<string, boolean>,
                      }))
                    }
                  >
                    <option value="">
                      {condition.counter?.derived ? '自動判定を使用' : '未確認'}
                    </option>
                    <option value="true">ゲーム内で達成を確認</option>
                    <option value="false">未達を確認</option>
                  </select>
                )}
                {condition.counter && (
                  <details className="mt-2 text-slate-300">
                    <summary className="cursor-pointer">
                      カウント対象 {condition.counter.taskIds.length}件
                      {condition.counter.derived &&
                        condition.state === 'unmet' &&
                        ` · あと${Math.max(0, condition.counter.required - condition.counter.completed)}件`}
                      {' · '}
                      {condition.counter.derived ? '補足データから計算' : '候補・自動判定対象外'}
                    </summary>
                    <p className="mt-1 text-xs text-slate-400">
                      コミュニティの検証データに基づく計算です。ゲーム内の結果が異なる場合は上の手動確認を使用してください。
                    </p>
                    <ul className="my-2 space-y-1">
                      {condition.counter.taskIds.map((id) => {
                        const candidate = snapshot?.tasks.find((t) => t.id === id);
                        const giver = snapshot?.traders.find((t) => t.id === candidate?.trader);
                        return (
                          <li key={id}>
                            {profile.tasks[id] === 'complete' ? '✓ ' : '○ '}
                            {candidate && giver ? (
                              <Link
                                className="text-sky-300 underline"
                                href={`/traders/${traderNameToSlug(giver.englishName)}#task-${id}`}
                              >
                                {candidate.name}
                              </Link>
                            ) : (
                              id
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {condition.counter.proof.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-2 text-xs text-sky-300 underline"
                      >
                        補足データの検証資料 ↗
                      </a>
                    ))}
                  </details>
                )}
              </li>
            );
          })}
        </ul>
        {(task.availableDelaySecondsMax ?? task.availableDelaySecondsMin ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              className={control}
              disabled={!!storageError}
              onClick={() =>
                edit((p) => ({
                  ...p,
                  delayStartedAt: { ...p.delayStartedAt, [task.id]: Date.now() },
                }))
              }
            >
              待機の起点を今の時刻で記録
            </button>
            <button
              className={control}
              disabled={!!storageError}
              onClick={() =>
                edit((p) => {
                  const delayStartedAt = { ...p.delayStartedAt };
                  delete delayStartedAt[task.id];
                  return { ...p, delayStartedAt };
                })
              }
            >
              起点を取り消す
            </button>
            {profile.delayStartedAt?.[task.id] && (
              <span>{new Date(profile.delayStartedAt[task.id]).toLocaleString('ja-JP')}</span>
            )}
          </div>
        )}
      </details>
      <details className="mt-3">
        <summary className="cursor-pointer text-amber-300">
          目標と進捗 ({task.objectives.length})
        </summary>
        <div className="mt-2 space-y-2">
          {task.objectives.map((objective) => (
            <ObjectiveProgress key={objective.id} taskId={task.id} objective={objective} />
          ))}
        </div>
      </details>
    </article>
  );
}
