import Link from 'next/link';
import TaskTreeView from '@/app/components/TaskTreeView';
import ProgressStats from '@/app/components/ProgressStats';
import TraderTaskSync from '@/app/components/TraderTaskSync';
import { getTaskData, getUniqueTraderNames } from '@/app/lib/taskData';
import { getFirItemsData } from '@/app/lib/firItemData';

interface PageProps {
  params: Promise<{
    trader: string;
  }>;
}

export async function generateStaticParams() {
  const taskData = getTaskData();
  const traders = getUniqueTraderNames(taskData);

  // 各トレーダーのパラメータを返す
  return traders.map(traderName => ({
    trader: encodeURIComponent(traderName),
  }));
}

export default async function TraderPage({ params }: PageProps) {
  const { trader: encodedTrader } = await params;
  const traderName = decodeURIComponent(encodedTrader);

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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-6">
          <Link
            href="/"
            className="text-yellow-400 hover:text-yellow-300 text-sm mb-3 inline-block"
          >
            ← トレーダー一覧に戻る
          </Link>

          <div className="flex items-center gap-4 mb-3">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <h1 className="text-4xl font-bold text-white">{traderName}</h1>
            <Link
              href={`/traders/${encodedTrader}/fir`}
              className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded transition-colors flex items-center gap-2"
            >
              📦 FiRタスクのみ表示
            </Link>
            <div className="flex-1 ml-8">
              <ProgressStats tasks={traderTasks} traderName={traderName} />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4" style={{ paddingTop: '2rem', paddingBottom: '2rem', height: 'calc(100vh - var(--header-height, 140px))' }}>
        <TraderTaskSync traderName={traderName} taskIds={traderTasks.map(t => t.id)} />
        <div style={{ height: 'calc(100% - 2rem)' }}>
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
