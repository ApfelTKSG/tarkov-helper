'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import type { GameTask } from '@/src/domain/game';
import { matchesTask, targetTasks } from '@/src/domain/task-view';
import ProfileControls from './ProfileControls';
import TaskPanel from './TaskPanel';
import TaskGraph from './TaskGraph';
import HideoutView from './HideoutView';
import RaidView from './RaidView';
import ItemOverview from './ItemOverview';

export type WorkspaceSection = 'tasks' | 'items' | 'collector' | 'hideout' | 'hideout-fir' | 'raid';
const control = 'rounded border border-slate-600 bg-slate-800 px-3 py-2';
export default function GameWorkspace({
  trader,
  section = 'tasks',
}: {
  trader?: string;
  section?: WorkspaceSection;
}) {
  const { snapshot, profile, ready, loading, error, availability, refresh } = useGame();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [target, setTarget] = useState('all');
  const [view, setView] = useState(trader ? 'graph' : 'list');
  const [selected, setSelected] = useState<GameTask | null>(null);
  const [limit, setLimit] = useState(40);
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const task = snapshot?.tasks.find((task) => `task-${task.id}` === id);
    if (task) requestAnimationFrame(() => setSelected(task));
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
            : (trader ?? 'タスク一覧');
  const traderDefinition = snapshot?.traders.find((t) => t.englishName === trader);
  const targetIds =
    snapshot && target !== 'all'
      ? new Set(targetTasks(snapshot, target as 'kappa' | 'lightkeeper').map((t) => t.id))
      : null;
  const scoped =
    snapshot?.tasks.filter(
      (task) =>
        (!trader || task.trader === traderDefinition?.id) &&
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
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 bg-slate-950">
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="text-2xl font-bold tracking-wide">
              Tarkov Helper
            </Link>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link className={control} href="/">
                タスク
              </Link>
              <Link className={control} href="/fir">
                FiR
              </Link>
              <Link className={control} href="/fir/collector">
                Collector
              </Link>
              <Link className={control} href="/traders/Hideout">
                ハイドアウト
              </Link>
              <Link className={control} href="/raid">
                レイド準備
              </Link>
            </nav>
          </div>
          <ProfileControls />
          <nav aria-label="トレーダー" className="flex flex-wrap gap-2 text-sm">
            {snapshot?.traders
              .filter((t) => snapshot.tasks.some((task) => task.trader === t.id))
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/traders/${traderNameToSlug(t.englishName)}`}
                  className={`rounded px-3 py-1 ${trader === t.englishName ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 hover:bg-slate-700'}`}
                >
                  {t.name}
                </Link>
              ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6">
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
                表示 {tasks.length}
                件。条件予測とゲーム内で記録した状態は別に保持します。同名タスクもIDごとに表示します。
                {target !== 'all' &&
                  '関連タスクはAPIのフラグに基づきます。現在の解放経路の全条件を保証するものではありません。'}
              </p>
              {(section === 'items' || section === 'collector') && <ItemOverview tasks={tasks} />}
              {view === 'graph' && section === 'tasks' && !!tasks.length && (
                <>
                  <TaskGraph
                    tasks={tasks}
                    onSelect={(task) => {
                      setSelected(task);
                      requestAnimationFrame(() =>
                        document
                          .getElementById('selected-task')
                          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                      );
                    }}
                  />
                  <p className="text-sm text-slate-400">
                    左からLL1〜LL4で表示します。本人のLL条件・補足分類に加え、前提タスクをたどったLLも列分けに反映します。「前提経由」の根拠は詳細で確認できます。受注可否は実際の完了状態と解放条件で別に判定します。内部条件があり分類も不明なタスクは「LL要確認」に表示します。ノードを押すと詳細、ホバーで前提の経路を表示します。ドラッグで移動、ホイールで拡大縮小できます。
                  </p>
                </>
              )}
              {currentSelected && (
                <section id="selected-task" className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-amber-300">選択したタスク</h2>
                    <button className={control} onClick={() => setSelected(null)}>
                      閉じる
                    </button>
                  </div>
                  <TaskPanel task={currentSelected} />
                </section>
              )}
              <div className="space-y-3">
                {tasks
                  .slice(0, limit)
                  .filter((t) => t.id !== currentSelected?.id)
                  .map((task) => (
                    <TaskPanel key={task.id} task={task} />
                  ))}
              </div>
              {tasks.length > limit && (
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
