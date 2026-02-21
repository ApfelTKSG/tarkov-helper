import Link from 'next/link';
import Image from 'next/image';
import TaskTreeView from '@/app/components/TaskTreeView';
import ProgressStats from '@/app/components/ProgressStats';
import TraderTaskSync from '@/app/components/TraderTaskSync';
import HomeHeaderControls from '@/app/components/HomeHeaderControls';
import TraderNav, { TRADER_IMAGES } from '@/app/components/TraderNav';
import { getTaskData, getUniqueTraderNames } from '@/app/lib/taskData';
import { getFirItemsData } from '@/app/lib/firItemData';
import { traderNameToSlug, slugToTraderName } from '@/app/lib/traderSlug';

interface PageProps {
  params: Promise<{
    trader: string;
  }>;
}

export async function generateStaticParams() {
  const taskData = getTaskData();
  const traders = getUniqueTraderNames(taskData);

  // 各トレーダーのパラメータを返す（スペースをハイフンに変換）
  return traders.map(traderName => ({
    trader: traderNameToSlug(traderName),
  }));
}

export default async function TraderPage({ params }: PageProps) {
  const { trader: traderSlug } = await params;
  const traderName = slugToTraderName(traderSlug);

  // タスクデータを読み込み
  const taskData = getTaskData();
  const firData = getFirItemsData();

  // タスクをタスク名+トレーダー名でユニーク化（重複を除去）
  const uniqueTasks = Array.from(
    taskData.tasks.reduce((map, task) => {
      const key = `${task.trader.name}::${task.name}`;
      if (!map.has(key)) {
        map.set(key, task);
      }
      return map;
    }, new Map()).values()
  );

  // 指定されたトレーダーのタスクを抽出
  const traderTasks = uniqueTasks.filter(task => task.trader.name === traderName);

  if (traderTasks.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">トレーダーが見つかりません</h1>
          <Link href="/" className="text-yellow-400 hover:underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    );
  }

  const totalExperience = traderTasks.reduce((sum, task) => sum + task.experience, 0);
  const traders = getUniqueTraderNames(taskData).filter(name => name !== 'Hideout').sort();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 flex-shrink-0">
        <div className="container mx-auto px-4 py-6">
          <TraderNav currentTrader={traderName} traders={traders} />

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mt-6">
            <div className="flex items-center gap-4">
              {TRADER_IMAGES[traderName] ? (
                <div className="w-16 h-16 relative rounded-lg overflow-hidden shadow-lg border border-gray-600 flex-shrink-0">
                  <Image src={TRADER_IMAGES[traderName]} alt={traderName} fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-16 h-16 relative rounded-lg shadow-lg border border-gray-600 flex items-center justify-center bg-gray-700 flex-shrink-0">
                  {traderName === 'Hideout' ? <span className="text-3xl">🛠️</span> : <span className="text-3xl">👑</span>}
                </div>
              )}
              <div>
                <h1 className="text-4xl font-bold text-white">{traderName}</h1>
                <div className="mt-2">
                  <ProgressStats tasks={traderTasks} traderName={traderName} />
                </div>
              </div>
            </div>

            <div className="md:ml-auto self-start">
              <HomeHeaderControls disableModes={['BTR Driver', 'Lightkeeper', 'Fence', 'Ref', 'Hideout'].includes(traderName)} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 flex-1 flex flex-col pt-8 pb-8" style={{ minHeight: 0 }}>
        <TraderTaskSync traderName={traderName} taskIds={traderTasks.map(t => t.id)} />
        <div className="flex-1 w-full relative min-h-[600px]">
          <TaskTreeView
            tasks={traderTasks}
            allTasks={uniqueTasks}
            traderName={traderName}
            firItemsData={firData}
          />
        </div>
      </main>
    </div>
  );
}
