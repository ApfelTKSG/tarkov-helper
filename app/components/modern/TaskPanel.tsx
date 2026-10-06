'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import type { GameTask, Objective } from '@/src/domain/game';
import type { TaskState } from '@/src/domain/progression';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import { changeTaskState, reputationRewards } from '@/src/domain/task-reputation';

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
  const favorite = profile.favorites.includes(task.id);
  const taskState = profile.tasks[task.id] ?? 'unstarted';
  const resolveName = (reference?: string) =>
    snapshot?.tasks.find((t) => t.id === reference)?.name ??
    snapshot?.traders.find((t) => t.id === reference)?.name ??
    '';
  return (
    <article
      id={`task-${task.id}`}
      className="scroll-mt-4 rounded-xl border border-slate-700 bg-slate-800 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">{task.name}</h3>
          {task.name !== task.englishName && (
            <p className="text-sm text-slate-400">{task.englishName}</p>
          )}
          <p className="text-xs text-slate-400">
            {snapshot?.traders.find((t) => t.id === task.trader)?.name} · {task.experience ?? 0} XP
            · {task.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={`${task.name} お気に入り`}
            aria-pressed={favorite}
            className={`${control} ${favorite ? 'text-amber-300' : ''}`}
            disabled={!!storageError}
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
          <select
            aria-label={`${task.name} 状態`}
            className={control}
            value={taskState}
            disabled={!!storageError}
            onChange={(e) => edit((p) => changeTaskState(p, task, e.target.value as TaskState))}
          >
            {Object.entries(stateNames).map(([state, name]) => (
              <option key={state} value={state}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>
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
        <span
          className={`rounded px-2 py-1 ${result.state === 'eligible' ? 'bg-emerald-900 text-emerald-200' : result.state === 'blocked' ? 'bg-red-950 text-red-200' : 'bg-amber-950 text-amber-200'}`}
        >
          {availabilityNames[result.state]}
        </span>
        <label>
          <input
            type="checkbox"
            checked={result.confirmedInGame}
            disabled={!!storageError}
            onChange={(e) =>
              edit((p) => ({
                ...p,
                confirmedAvailable: { ...p.confirmedAvailable, [task.id]: e.target.checked },
              }))
            }
          />{' '}
          ゲーム内で受注可能と確認
        </label>
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
                    <option value="">未確認</option>
                    <option value="true">ゲーム内で達成を確認</option>
                    <option value="false">未達を確認</option>
                  </select>
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
