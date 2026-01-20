import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { TaskData } from '@/app/types/task';
import TaskTreeView from '@/app/components/TaskTreeView';

interface PageProps {
  params: Promise<{
    trader: string;
  }>;
}

export default async function TraderPage({ params }: PageProps) {
  const { trader: encodedTrader } = await params;
  const traderName = decodeURIComponent(encodedTrader);

  // タスクデータを読み込み
  const filePath = path.join(process.cwd(), 'data', 'tarkov-tasks.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  const taskData: TaskData = JSON.parse(fileContents);

  // 指定されたトレーダーのタスクを抽出
  const traderTasks = taskData.tasks.filter(task => task.trader.name === traderName);

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

  const rootTasks = traderTasks.filter(t => t.taskRequirements.length === 0);
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
          </div>
          
          <div className="flex flex-wrap gap-6 text-sm text-gray-400">
            <div>
              <span className="text-gray-500">総タスク数: </span>
              <span className="text-white font-semibold">{traderTasks.length}</span>
            </div>
            <div>
              <span className="text-gray-500">ルートタスク: </span>
              <span className="text-green-400 font-semibold">{rootTasks.length}</span>
            </div>
            <div>
              <span className="text-gray-500">依存タスク: </span>
              <span className="text-blue-400 font-semibold">{traderTasks.length - rootTasks.length}</span>
            </div>
            <div>
              <span className="text-gray-500">合計経験値: </span>
              <span className="text-yellow-400 font-semibold">+{totalExperience.toLocaleString()} XP</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <TaskTreeView tasks={traderTasks} allTasks={taskData.tasks} />
      </main>
    </div>
  );
}
