'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { interactingTaskIds, matchesTask } from '@/src/domain/task-view';
import { matchesPrestige, newBeginningStage, prestigeCoverage } from '@/src/domain/prestige';
import TaskDialog from './TaskDialog';
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import { canToggleTaskCompletion } from '@/src/domain/task-presentation';
import TaskGraph from './TaskGraph';
import HideoutView from './HideoutView';
import RaidView from './RaidView';
import FirDashboard from './FirDashboard';
import CollectorBadge, { COLLECTOR_ID } from './CollectorBadge';
import { taskVariantLabel } from '@/src/domain/task-variant';
import TraderDashboard from './TraderDashboard';
import MapTasks from './MapTasks';

import WorkspaceHeader, { type WorkspaceSection } from './WorkspaceHeader';
export type { WorkspaceSection } from './WorkspaceHeader';
const control = 'ui-control';
export default function GameWorkspace({
  trader,
  section = 'tasks',
}: {
  trader?: string;
  section?: WorkspaceSection;
}) {
  const { snapshot, profile, ready, loading, error, availability, refresh, edit, storageError } =
    useGame();
  const [query, setQuery] = useState('');
  const filter = profile.taskFilter ?? 'all';
  const [view, setView] = useState('graph');
  const [selected, setSelected] = useState<GameTask | null>(null);
  const [limit, setLimit] = useState(40);
  const crossTraderGraph = !trader && section === 'tasks' && view === 'graph';
  const interactingIds = useMemo(
    () => (crossTraderGraph ? interactingTaskIds(snapshot?.tasks ?? []) : null),
    [crossTraderGraph, snapshot?.tasks],
  );
  useEffect(() => {
    let frame = 0;
    const openLinkedTask = () => {
      const task = snapshot?.tasks.find((task) => `#task-${task.id}` === window.location.hash);
      if (task) frame = requestAnimationFrame(() => setSelected(task));
    };
    openLinkedTask();
    window.addEventListener('hashchange', openLinkedTask);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', openLinkedTask);
    };
  }, [snapshot]);
  const title =
    section === 'raid'
      ? 'レイド準備'
      : section.startsWith('hideout')
        ? 'ハイドアウト'
        : section === 'collector'
          ? 'Collectorのアイテム'
          : section === 'items'
            ? 'FiRアイテム管理'
            : (trader ?? (crossTraderGraph ? 'トレーダー間のタスクライン' : 'タスク一覧'));
  const traderDefinition = snapshot?.traders.find((t) => t.englishName === trader);
  const scoped =
    snapshot?.tasks.filter(
      (task) =>
        matchesPrestige(task, profile.prestige) &&
        (!(section === 'items' || section === 'collector') ||
          profile.prestige !== undefined ||
          newBeginningStage(task) === undefined) &&
        (!trader || task.trader === traderDefinition?.id) &&
        (!interactingIds || interactingIds.has(task.id)) &&
        (!(section === 'items' || section === 'collector') ||
          task.objectives.some((o) => o.type === 'giveItem' && o.foundInRaid)),
    ) ?? [];
  const tasks = scoped.filter(
    (task) =>
      matchesTask(task, query, snapshot!) &&
      (filter === 'all' ||
        (filter === 'favorites' &&
          profile.tasks[task.id] !== 'complete' &&
          profile.favorites.includes(task.id)) ||
        (filter === 'active' &&
          !['complete', 'failed'].includes(profile.tasks[task.id] ?? 'unstarted') &&
          (profile.tasks[task.id] === 'active' || availability(task).state === 'eligible'))),
  );
  const completed = scoped.filter((task) => profile.tasks[task.id] === 'complete').length;
  const currentSelected = selected
    ? snapshot?.tasks.find((task) => task.id === selected.id)
    : undefined;
  const traderDashboard = section === 'tasks' && !!traderDefinition;
  const graphView = section === 'tasks' && !trader && view === 'graph';
  const inventoryPage = section === 'items' || section === 'collector';
  const tablePage = (section === 'tasks' && !!trader) || section === 'maps' || inventoryPage;
  const fixedWorkspace = graphView || tablePage;
  return (
    <div
      className={`workspace bg-slate-900 text-slate-100 ${fixedWorkspace ? 'flex h-dvh min-h-0 flex-col overflow-hidden' : 'min-h-dvh'}`}
    >
      <WorkspaceHeader trader={trader} section={section} />
      <main
        className={
          tablePage
            ? 'flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 py-3 sm:px-5'
            : graphView
              ? 'flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-5 [&>*]:shrink-0'
              : 'mx-auto max-w-7xl space-y-5 px-4 py-6'
        }
      >
        {!tablePage && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">{title}</h1>
            {snapshot &&
              !traderDashboard &&
              !section.startsWith('hideout') &&
              section !== 'raid' && (
                <p className="text-sm text-slate-300">
                  完了 {completed} / {scoped.length} · 受注中{' '}
                  {
                    scoped.filter(
                      (t) =>
                        !['complete', 'failed'].includes(profile.tasks[t.id] ?? 'unstarted') &&
                        (profile.tasks[t.id] === 'active' || availability(t).state === 'eligible'),
                    ).length
                  }
                </p>
              )}
          </div>
        )}
        {error && (
          <div role="alert" className="rounded border border-red-800 bg-red-950 p-4">
            {error} {snapshot && '最後に読み込めたデータを表示しています。'}
            <button className={`${control} ml-3`} onClick={refresh}>
              再試行
            </button>
          </div>
        )}
        {(!ready || loading) && !error && <p role="status">ゲームデータと進捗を読み込み中…</p>}
        {snapshot &&
          (section.startsWith('hideout') ? (
            <HideoutView firOnly={section === 'hideout-fir'} />
          ) : section === 'raid' ? (
            <RaidView />
          ) : section === 'maps' ? (
            <MapTasks key={profile.id} />
          ) : inventoryPage ? (
            <FirDashboard
              key={`${profile.id}:${section}:${trader ?? ''}`}
              tasks={scoped}
              initialScope={section === 'collector' ? 'collector' : 'all'}
            />
          ) : traderDashboard ? (
            <>
              <TraderDashboard
                key={`${profile.id}:${traderDefinition.id}`}
                trader={traderDefinition}
                tasks={scoped}
                linkedTask={currentSelected}
                onClearLinked={() => setSelected(null)}
              />
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  aria-label="タスク・アイテム検索"
                  className={`${control} min-w-52 flex-1`}
                  placeholder="タスク名・アイテム名・IDを日英で検索"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <select
                  aria-label="表示対象"
                  className={control}
                  value={filter}
                  disabled={!ready || !!storageError}
                  onChange={(e) =>
                    edit((p) => ({
                      ...p,
                      taskFilter: e.target.value as 'all' | 'active' | 'favorites',
                    }))
                  }
                >
                  <option value="all">すべて</option>
                  <option value="active">受注中</option>
                  <option value="favorites">お気に入り</option>
                </select>
                {section === 'tasks' && (
                  <button
                    className={control}
                    onClick={() => setView((v) => (v === 'graph' ? 'list' : 'graph'))}
                  >
                    {view === 'graph' ? '一覧に切り替え' : 'グラフに切り替え'}
                  </button>
                )}
                <span className="text-xs text-slate-400">{tasks.length}件</span>
              </div>
              {profile.prestige === undefined ? (
                <p className="text-sm text-amber-300">
                  現在のプレステージを入力すると、その段階のNew
                  Beginningを表示します。FiR必要数には入力後に反映します。
                </p>
              ) : (
                !prestigeCoverage(snapshot, profile.prestige) && (
                  <p className="text-sm text-amber-300">
                    このモードのプレステージ {profile.prestige + 1} 向けNew
                    Beginningはデータ未収録です。FiR必要数には含めていません。
                  </p>
                )
              )}
              {crossTraderGraph && !!tasks.length && (
                <>
                  <TaskGraph
                    tasks={tasks}
                    layout="depth"
                    revealMatches={!!query.trim()}
                    selectedId={currentSelected?.id}
                    onSelect={setSelected}
                  />
                  <p className="text-xs text-slate-400">
                    クリック：完了・取り消し　／　Shift＋クリック・右クリック：詳細
                  </p>
                  <details className="text-sm text-slate-400">
                    <summary className="cursor-pointer">表示の説明</summary>
                    <p className="mt-2">
                      他トレーダーと前提・後続でつながるラインを表示します。半透明のタスクはクリックで完了できません。条件予測とゲーム内の記録は別に保持し、同名タスクもIDで区別します。
                    </p>
                    <p className="mt-2">
                      灰色半透明：受けられない · 黄色縁半透明：条件未確認 · 灰色：受注中 ·
                      緑色：完了 ·
                      赤色：失敗。受注条件を満たしたタスクは受注中として表示します。★と金色の枠はお気に入りです。
                    </p>
                    <p className="mt-2">
                      前提なしが深さ1、前提の最大深さ＋1が次の列です。複数トレーダーの前提も含めて計算し、同じ深さのタスクを縦に並べます。検索・絞り込みでも元の深さを保持します。右下はLL、左上は必要レベル、右上は報酬です。
                    </p>
                  </details>
                </>
              )}
              {currentSelected && (
                <TaskDialog task={currentSelected} onClose={() => setSelected(null)} />
              )}
              {section === 'tasks' && view === 'list' && (
                <div className="space-y-3">
                  {tasks.slice(0, limit).map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 rounded border bg-slate-800 p-3 ${task.id === COLLECTOR_ID || (profile.tasks[task.id] !== 'complete' && profile.favorites.includes(task.id)) ? 'border-amber-400/70 ring-1 ring-amber-400/30' : 'border-slate-700'}`}
                    >
                      <button
                        className={`flex-1 text-left ${profile.tasks[task.id] === 'complete' ? 'text-emerald-300' : ''}`}
                        disabled={!ready || !!storageError}
                        onClick={(event) =>
                          event.shiftKey
                            ? setSelected(task)
                            : canToggleTaskCompletion(
                                profile.tasks[task.id] ?? 'unstarted',
                                availability(task).state,
                              ) && edit((p) => toggleTaskCompletion(p, task))
                        }
                      >
                        {profile.tasks[task.id] === 'complete' ? '✓ ' : ''}
                        {profile.tasks[task.id] !== 'complete' &&
                          profile.favorites.includes(task.id) && (
                            <span className="mr-1 text-amber-300">★</span>
                          )}
                        {task.name}
                        {taskVariantLabel(task, snapshot.tasks) && (
                          <span className="ml-2 text-xs font-normal text-sky-200">
                            {taskVariantLabel(task, snapshot.tasks)}
                          </span>
                        )}
                        {task.id === COLLECTOR_ID && (
                          <span className="ml-2">
                            <CollectorBadge />
                          </span>
                        )}
                      </button>
                      <button className={control} onClick={() => setSelected(task)}>
                        詳細
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {section === 'tasks' && view === 'list' && tasks.length > limit && (
                <button className={control} onClick={() => setLimit((value) => value + 40)}>
                  さらに40件表示 ({tasks.length - limit}件)
                </button>
              )}
              {!tasks.length && (
                <p className="text-slate-400">このモード・絞り込みに該当するタスクはありません。</p>
              )}
            </>
          ))}
      </main>
    </div>
  );
}
