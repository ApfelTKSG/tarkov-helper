'use client';

import { useEffect, useState } from 'react';
import { Task } from '../types/task';

interface ProgressStatsProps {
  tasks: Task[];
  traderName: string;
}

export default function ProgressStats({ tasks, traderName }: ProgressStatsProps) {
  const [completedCount, setCompletedCount] = useState(0);

  // κタスクのみをフィルタリング
  const collectorTasks = tasks.filter(t => t.isCollectorRequirement);
  const collectorTaskIds = collectorTasks.map(t => t.id);

  useEffect(() => {
    const updateStats = () => {
      const saved = localStorage.getItem('tarkov-completed-tasks');
      if (saved) {
        try {
          const completedTasks = new Set(JSON.parse(saved));
          const completed = collectorTaskIds.filter(id => completedTasks.has(id)).length;
          setCompletedCount(completed);
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
  }, [collectorTaskIds]);

  if (collectorTasks.length === 0) {
    return (
      <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
        <div className="text-sm text-gray-400">
          このトレーダーにはκタスクがありません
        </div>
      </div>
    );
  }

  const percentage = Math.round((completedCount / collectorTasks.length) * 100);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-orange-400 font-semibold">κタスク進捗</span>
        <span className="text-white font-bold">
          {completedCount} / {collectorTasks.length} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-3">
        <div
          className="bg-orange-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
