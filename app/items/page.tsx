import FirItemsList from '@/app/components/FirItemsList';
import { getFirItemsData } from '@/app/lib/firItemData';
import Link from 'next/link';

export default function ItemsPage() {
  const firData = getFirItemsData();

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 mb-4 inline-block"
          >
            ← ホームに戻る
          </Link>
          
          <h1 className="text-3xl font-bold mb-2">Found in Raid アイテム一覧</h1>
          <p className="text-gray-400">
            タスクで必要なFound in Raid (FiR) アイテムの一覧です
          </p>
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">全タスク数</p>
            <p className="text-2xl font-bold text-white">
              {firData.summary.totalTasks}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">FiR必要タスク</p>
            <p className="text-2xl font-bold text-blue-400">
              {firData.summary.tasksRequiringFiR}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">ユニークFiRアイテム</p>
            <p className="text-2xl font-bold text-purple-400">
              {firData.summary.uniqueFiRItems}
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">最終更新</p>
            <p className="text-sm font-medium text-gray-300">
              {new Date(firData.summary.generatedAt).toLocaleDateString('ja-JP')}
            </p>
          </div>
        </div>

        {/* アイテムリスト */}
        <FirItemsList items={firData.itemsIndex} />

        {/* フッター情報 */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg text-sm text-gray-400">
          <p className="mb-2">
            💡 <strong>ヒント:</strong> ゲーム内でFound in Raidアイテムを見つけたら、
            このリストを確認してタスクで必要かどうかをチェックしましょう。
          </p>
          <p>
            データは{' '}
            <a
              href="https://api.tarkov.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              Tarkov API
            </a>
            {' '}から取得しています。
          </p>
        </div>
      </div>
    </div>
  );
}
