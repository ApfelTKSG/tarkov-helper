'use client';

import { useEffect, useState } from 'react';
import { Task } from '../types/task';

interface ProgressStatsProps {
  tasks: Task[];
  traderName: string;
}

export default function ProgressStats({ tasks, traderName }: ProgressStatsProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCompletedCount, setTotalCompletedCount] = useState(0);

  // κタスクのみをフィルタリング
  const collectorTasks = tasks.filter(t => t.isCollectorRequirement);
  const collectorTaskIds = collectorTasks.map(t => t.id);
  const allTaskIds = tasks.map(t => t.id);

  useEffect(() => {
    const updateStats = () => {
      const saved = localStorage.getItem('tarkov-completed-tasks');
      if (saved) {
        try {
          const completedTasks = new Set(JSON.parse(saved));
          const completed = collectorTaskIds.filter(id => completedTasks.has(id)).length;
          const totalCompleted = allTaskIds.filter(id => completedTasks.has(id)).length;
          setCompletedCount(completed);
          setTotalCompletedCount(totalCompleted);
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
  }, [collectorTaskIds, allTaskIds]);

  const percentage = collectorTasks.length > 0 
    ? Math.round((completedCount / collectorTasks.length) * 100) 
    : 0;
  const totalPercentage = Math.round((totalCompletedCount / tasks.length) * 100);

  return (
    <div className="space-y-3">
      {collectorTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-orange-400 font-semibold text-sm">κタスク</span>
            <span className="text-white font-bold text-sm">
              {completedCount} / {collectorTasks.length} ({percentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      )}
      
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-blue-400 font-semibold text-sm">全タスク</span>
          <span className="text-white font-bold text-sm">
            {totalCompletedCount} / {tasks.length} ({totalPercentage}%)
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${totalPercentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
