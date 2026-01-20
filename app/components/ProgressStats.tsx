'use client';

import { useEffect, useState } from 'react';

interface ProgressStatsProps {
  totalTasks: number;
  traderName?: string;
}

export default function ProgressStats({ totalTasks, traderName }: ProgressStatsProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const [taskIds, setTaskIds] = useState<string[]>([]);

  // このトレーダーのタスクIDを保存
  useEffect(() => {
    // ページのタスクIDを取得（親から渡す必要あり）
    const saved = localStorage.getItem(`tarkov-trader-tasks-${traderName}`);
    if (saved) {
      setTaskIds(JSON.parse(saved));
    }
  }, [traderName]);

  useEffect(() => {
    const updateStats = () => {
      const saved = localStorage.getItem('tarkov-completed-tasks');
      if (saved) {
        try {
          const allCompleted = new Set(JSON.parse(saved));
          // このトレーダーのタスクのみカウント
          const traderCompleted = taskIds.filter(id => allCompleted.has(id));
          setCompletedCount(traderCompleted.length);
        } catch (e) {
          console.error('Failed to parse completed tasks:', e);
        }
      }
    };

    // 初回読み込み
    updateStats();

    // ストレージ変更を監視
    const interval = setInterval(updateStats, 500);
    return () => clearInterval(interval);
  }, []);

  const percentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <div className="bg-gray-700 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">進捗状況</span>
        <span className="text-lg font-bold text-white">
          {completedCount} / {totalTasks}
        </span>
      </div>
      <div className="w-full bg-gray-600 rounded-full h-3 overflow-hidden">
        <div
          className="bg-green-500 h-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-right mt-1">
        <span className="text-xs text-gray-400">{percentage}% 完了</span>
      </div>
    </div>
  );
}
