'use client';

import { useEffect, useState } from 'react';
import { Task } from '../types/task';

interface TraderCardProgressProps {
  tasks: Task[];
}

export default function TraderCardProgress({ tasks }: TraderCardProgressProps) {
  const [completedCount, setCompletedCount] = useState(0);

  // κタスクのみをフィルタリング
  const collectorTasks = tasks.filter(t => t.isCollectorRequirement);
  const collectorTaskIds = collectorTasks.map(t => t.id);

  useEffect(() => {
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
  }, [collectorTaskIds]);

  if (collectorTasks.length === 0) {
    return (
      <div className="mt-3 text-xs text-gray-500">
        κタスクなし
      </div>
    );
  }

  const percentage = Math.round((completedCount / collectorTasks.length) * 100);

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-sm mb-1">
        <span className="text-orange-400">κ進捗:</span>
        <span className="text-white font-semibold">
          {completedCount} / {collectorTasks.length}
        </span>
        <span className="text-gray-500">({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-orange-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
