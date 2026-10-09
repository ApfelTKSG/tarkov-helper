'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import type { GameTask } from '@/src/domain/game';
import { interactingTaskIds, matchesTask, targetTasks } from '@/src/domain/task-view';
import ProfileControls from './ProfileControls';
import { matchesPrestige, newBeginningStage, prestigeCoverage } from '@/src/domain/prestige';
import TaskDialog from './TaskDialog';
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import TaskGraph from './TaskGraph';
import HideoutView from './HideoutView';
import RaidView from './RaidView';
import ItemOverview from './ItemOverview';
import ApiImage from './ApiImage';
import { visibleTrader } from '@/src/domain/traders';
import CollectorBadge, { COLLECTOR_ID } from './CollectorBadge';

export type WorkspaceSection = 'tasks' | 'items' | 'collector' | 'hideout' | 'hideout-fir' | 'raid';
const control = 'rounded border border-slate-600 bg-slate-800 px-3 py-2';
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
  const [filter, setFilter] = useState('all');
  const [target, setTarget] = useState('all');
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
  const targetIds =
    snapshot && target !== 'all'
      ? new Set(targetTasks(snapshot, target as 'kappa' | 'lightkeeper').map((t) => t.id))
      : null;
  const scoped =
    snapshot?.tasks.filter(
      (task) =>
        matchesPrestige(task, profile.prestige) &&
        (!(section === 'items' || section === 'collector') ||
          profile.prestige !== undefined ||
          newBeginningStage(task) === undefined) &&
        (!trader || task.trader === traderDefinition?.id) &&
        (!interactingIds || interactingIds.has(task.id)) &&
        (section !== 'collector' || task.englishName === 'Collector') &&
        (section !== 'items' ||
          task.objectives.some((o) => o.type === 'giveItem' && o.foundInRaid)),
    ) ?? [];
  const tasks = scoped.filter(
    (task) =>
      (!targetIds || targetIds.has(task.id)) &&
      matchesTask(task, query, snapshot!) &&
      (filter === 'all' ||
        (filter === 'favorites' && profile.favorites.includes(task.id)) ||
        (filter === 'remaining' &&
          !['complete', 'failed'].includes(profile.tasks[task.id] ?? 'unstarted')) ||
        (filter === 'active' && profile.tasks[task.id] === 'active') ||
        (filter === 'eligible' && availability(task).state === 'eligible') ||
        (filter === 'unknown' && availability(task).state === 'unknown')),
  );
  const completed = scoped.filter((task) => profile.tasks[task.id] === 'complete').length;
  const currentSelected = selected
    ? snapshot?.tasks.find((task) => task.id === selected.id)
    : undefined;
  const graphView = section === 'tasks' && view === 'graph';
  const tabControl = 'rounded border border-slate-600 bg-slate-800 px-4 py-2.5 font-medium';
  return (
    <div
      className={`min-h-dvh bg-slate-900 text-slate-100 ${graphView ? 'flex h-dvh flex-col' : ''}`}
    >
      <header className="shrink-0 border-b border-slate-700 bg-slate-950">
        <div className={`space-y-3 px-3 py-3 sm:px-5 ${graphView ? '' : 'mx-auto max-w-7xl'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-2xl font-bold tracking-wide">
              Tarkov Helper
            </Link>
            <nav className="flex flex-wrap gap-2 text-base md:text-lg">
              <Link className={tabControl} href="/">
                タスク
              </Link>
              <Link className={tabControl} href="/fir">
                FiR
              </Link>
              <Link className={tabControl} href="/fir/collector">
                Collector
              </Link>
              <Link className={tabControl} href="/traders/Hideout">
                ハイドアウト
              </Link>
              <Link className={tabControl} href="/raid">
                レイド準備
              </Link>
            </nav>
          </div>
          <ProfileControls />
          <nav aria-label="トレーダー" className="flex flex-wrap gap-2 text-base md:text-lg">
            <Link
              href="/"
              aria-label="全トレーダー"
              aria-current={!trader && section === 'tasks' ? 'page' : undefined}
              className={`flex w-20 flex-col items-center justify-center gap-1 rounded border-2 p-1 text-center text-xs ${!trader && section === 'tasks' ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-800 hover:border-sky-400'}`}
            >
              <span
                className="flex h-14 w-14 items-center justify-center text-3xl"
                aria-hidden="true"
              >
                ▦
              </span>
              <span>全トレーダー</span>
            </Link>
            {snapshot?.traders
              .filter(
                (t) => visibleTrader(t) && snapshot.tasks.some((task) => task.trader === t.id),
              )
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/traders/${traderNameToSlug(t.englishName)}`}
                  aria-label={t.name}
                  aria-current={trader === t.englishName ? 'page' : undefined}
                  className={`flex w-20 flex-col items-center gap-1 rounded border-2 p-1 text-center text-xs ${trader === t.englishName ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-800 hover:border-sky-400'}`}
                >
                  <ApiImage
                    src={t.imageLink}
                    name={t.name}
                    className="h-14 w-14 rounded object-cover"
                  />
                  <span>{t.name}</span>
                </Link>
              ))}
          </nav>
        </div>
      </header>
      <main
        className={
          graphView
            ? 'flex min-h-0 flex-1 flex-col gap-3 px-3 py-3 sm:px-5 [&>*]:shrink-0'
            : 'mx-auto max-w-7xl space-y-5 px-4 py-6'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{title}</h1>
          {snapshot && !section.startsWith('hideout') && section !== 'raid' && (
            <p className="text-sm text-slate-300">
              完了 {completed} / {scoped.length} · 受注中{' '}
              {scoped.filter((t) => profile.tasks[t.id] === 'active').length}
            </p>
          )}
        </div>
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
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
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
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">すべて</option>
                  <option value="remaining">未完了</option>
                  <option value="active">受注中</option>
                  <option value="eligible">条件を満たす</option>
                  <option value="unknown">要確認</option>
                  <option value="favorites">お気に入り</option>
                </select>
                <select
                  aria-label="目標"
                  className={control}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="all">すべての目標</option>
                  <option value="kappa">Kappa関連 (API)</option>
                  <option value="lightkeeper">Lightkeeper関連 (API)</option>
                </select>
                {section === 'tasks' && (
                  <button
                    className={control}
                    onClick={() => setView((v) => (v === 'graph' ? 'list' : 'graph'))}
                  >
                    {view === 'graph' ? '一覧に切り替え' : 'グラフに切り替え'}
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-400">
                {crossTraderGraph && '他トレーダーと前提・後続でつながるラインのみ表示。'}
                表示 {tasks.length}
                件。条件予測とゲーム内で記録した状態は別に保持します。同名タスクもIDごとに表示します。
                {target !== 'all' &&
                  '関連タスクはAPIのフラグに基づきます。現在の解放経路の全条件を保証するものではありません。'}
              </p>
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
              {(section === 'items' || section === 'collector') && <ItemOverview tasks={tasks} />}
              {view === 'graph' && section === 'tasks' && !!tasks.length && (
                <>
                  <TaskGraph
                    tasks={tasks}
                    layout={crossTraderGraph ? 'depth' : 'split'}
                    revealMatches={!!query.trim()}
                    selectedId={currentSelected?.id}
                    onSelect={setSelected}
                  />
                  <p className="text-sm text-sky-200">
                    クリックで完了・取り消し · Shift＋クリック（または右クリック）で詳細 ·
                    {crossTraderGraph
                      ? '左から前提の深さ順'
                      : '左：タスクライン（深さ順） · 右：単独タスク（LL別）'}
                  </p>
                  <details className="text-sm text-slate-400">
                    <summary className="cursor-pointer">表示の説明</summary>
                    <p className="mt-2">
                      {crossTraderGraph
                        ? '前提なしが深さ1、前提の最大深さ＋1が次の列です。複数トレーダーの前提も含めて計算し、同じ深さのタスクを縦に並べます。検索・絞り込みでも元の深さを保持します。統合グラフではフォルダにまとめず個別ノードを表示し、右下にLLを残します。'
                        : '同じトレーダー内で前提・後続がつながるタスクは、左側に深さ順で個別表示します。つながりのないタスクは右側のLL列へ置きます。ラインはフォルダにまとめず、LLは各ノード右下に表示します。深さ・ラインへの分類は検索前の全タスクから判定します。左上は必要レベル、右上は報酬、左下は前提の充足数です。ドラッグで移動、ホイールで拡大縮小できます。'}
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
                      className={`flex items-center gap-3 rounded border bg-slate-800 p-3 ${task.id === COLLECTOR_ID ? 'border-amber-400/70 ring-1 ring-amber-400/30' : 'border-slate-700'}`}
                    >
                      <button
                        className={`flex-1 text-left ${profile.tasks[task.id] === 'complete' ? 'text-emerald-300' : ''}`}
                        disabled={!ready || !!storageError}
                        onClick={(event) =>
                          event.shiftKey
                            ? setSelected(task)
                            : edit((p) => toggleTaskCompletion(p, task))
                        }
                      >
                        {profile.tasks[task.id] === 'complete' ? '✓ ' : ''}
                        {task.name}
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
