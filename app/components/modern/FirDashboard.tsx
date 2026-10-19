'use client';

import { useState } from 'react';
import type { GameTask } from '@/src/domain/game';
import { useGame } from '@/app/context/GameContext';
import { prestigeCoverage } from '@/src/domain/prestige';
import ItemOverview from './ItemOverview';
import { COLLECTOR_ID } from './CollectorBadge';

type Scope = 'all' | 'tasks' | 'collector';
export default function FirDashboard({
  tasks,
  initialScope = 'all',
}: {
  tasks: GameTask[];
  initialScope?: Scope;
}) {
  const { profile, snapshot } = useGame();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [query, setQuery] = useState('');
  const [remainingOnly, setRemainingOnly] = useState(false);
  const scoped = tasks.filter(
    (task) =>
      scope === 'all' ||
      (scope === 'collector' ? task.id === COLLECTOR_ID : task.id !== COLLECTOR_ID),
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">FiRアイテム</h1>
        <nav aria-label="FiRの用途" className="flex gap-1">
          {(
            [
              ['all', 'すべて'],
              ['tasks', 'タスク'],
              ['collector', 'Collector'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="ui-nav-link"
              aria-current={scope === key ? 'page' : undefined}
              onClick={() => setScope(key)}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        <input
          aria-label="FiRアイテム検索"
          placeholder="アイテム・タスクを検索"
          className="ui-control min-w-40 flex-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <label className="flex items-center gap-2 text-[13px] text-slate-300">
          <input
            type="checkbox"
            checked={remainingOnly}
            onChange={(event) => setRemainingOnly(event.target.checked)}
            className="h-4 w-4 accent-emerald-400"
          />
          未確保のみ
        </label>
      </div>
      {scope !== 'collector' &&
        snapshot &&
        (profile.prestige === undefined || !prestigeCoverage(snapshot, profile.prestige)) && (
          <details className="shrink-0 text-xs text-slate-400">
            <summary className="cursor-pointer">New Beginningの収集対象について</summary>
            <p className="mt-1">
              {profile.prestige === undefined
                ? '設定で現在のプレステージを入力すると、その段階の必要アイテムを含めます。'
                : 'この段階のNew Beginningは未収録のため、必要数に含めていません。'}
            </p>
          </details>
        )}
      <ItemOverview tasks={scoped} query={query} remainingOnly={remainingOnly} />
    </div>
  );
}
