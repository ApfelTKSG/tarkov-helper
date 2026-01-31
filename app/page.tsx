import HomeHeaderControls from './components/HomeHeaderControls';
import Link from 'next/link';
import TraderCardProgress from './components/TraderCardProgress';
import { getTaskData } from './lib/taskData';
import { traderNameToSlug } from './lib/traderSlug';

export default function Home() {
  // タスクデータを読み込み
  const taskData = getTaskData();

  // トレーダーごとにグループ化
  const tasksByTrader = taskData.tasks.reduce((acc, task) => {
    const traderName = task.trader.name;
    if (!acc[traderName]) {
      acc[traderName] = [];
    }
    acc[traderName].push(task);
    return acc;
  }, {} as Record<string, typeof taskData.tasks>);

  // トレーダーリスト
  const traders = Object.keys(tasksByTrader).sort();

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="container mx-auto px-4 py-6 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-white">Tarkov Helper</h1>
            <p className="text-gray-400 mt-2">タスク管理ツール - {taskData.tasks.length}個のタスク</p>
          </div>
          <HomeHeaderControls />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">トレーダー一覧</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {traders.map(traderName => {
              const traderTasks = tasksByTrader[traderName];

              return (
                <Link
                  key={traderName}
                  href={`/traders/${traderNameToSlug(traderName)}`}
                  className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-all hover:scale-105 hover:shadow-xl border-2 border-transparent hover:border-yellow-400"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <h3 className="text-2xl font-bold text-white">{traderName}</h3>
                  </div>

                  <div className="space-y-2 text-sm text-gray-400">
                    <div className="flex justify-between">
                      <span>タスク数:</span>
                      <span className="text-white font-semibold">{traderTasks.length}</span>
                    </div>
                  </div>

                  <TraderCardProgress tasks={traderTasks} />

                  <div className="mt-4 text-yellow-400 text-sm font-medium flex items-center gap-2">
                    詳細を見る
                    <span>→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
