'use client';

import { useEffect, useState } from 'react';

interface TraderCardProgressProps {
  taskIds: string[];
}

export default function TraderCardProgress({ taskIds }: TraderCardProgressProps) {
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('tarkov-completed-tasks');
    if (saved) {
      try {
        const completedTasks = new Set(JSON.parse(saved));
        const completed = taskIds.filter(id => completedTasks.has(id)).length;
        setCompletedCount(completed);
      } catch (e) {
        console.error('Failed to parse completed tasks:', e);
      }
    }
  }, [taskIds]);

  const percentage = taskIds.length > 0 ? Math.round((completedCount / taskIds.length) * 100) : 0;

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-sm mb-1">
        <span className="text-gray-400">進捗:</span>
        <span className="text-white font-semibold">
          {completedCount} / {taskIds.length}
        </span>
        <span className="text-gray-500">({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="bg-green-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
