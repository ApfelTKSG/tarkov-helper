'use client';

import { useEffect, useState } from 'react';
import { Task } from '../types/task';
import { useFilterMode } from '../context/FilterModeContext';

interface TraderCardProgressProps {
  tasks: Task[];
}

export default function TraderCardProgress({ tasks }: TraderCardProgressProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const { kappaMode, lightkeeperMode } = useFilterMode();

  // フィルタリングロジック
  const targetTasks = tasks.filter(t => {
    const isKappa = t.isCollectorRequirement;
    const isLightkeeper = t.isLightkeeperRequirement;

    if (kappaMode && !lightkeeperMode) return isKappa;
    if (!kappaMode && lightkeeperMode) return isLightkeeper;
    if (kappaMode && lightkeeperMode) return isKappa || isLightkeeper;

    // 両方オフの場合は全タスク
    return true;
  });

  const targetTaskIds = targetTasks.map(t => t.id);

  useEffect(() => {
    const saved = localStorage.getItem('tarkov-completed-tasks');
    if (saved) {
      try {
        const completedTasks = new Set(JSON.parse(saved));
        const completed = targetTaskIds.filter(id => completedTasks.has(id)).length;
        setCompletedCount(completed);
      } catch (e) {
        console.error('Failed to parse completed tasks:', e);
      }
    }
  }, [targetTaskIds]); // targetTaskIdsの内容が変わったら再計算（実際にはlengthや中身が変わる）

  // タスクがない場合
  if (targetTasks.length === 0) {
    // モードによってメッセージを変える
    let message = "タスクなし";
    if (kappaMode && !lightkeeperMode) message = "κタスクなし";
    if (!kappaMode && lightkeeperMode) message = "LKタスクなし";

    return (
      <div className="mt-3 text-xs text-gray-500">
        {message}
      </div>
    );
  }

  const percentage = Math.round((completedCount / targetTasks.length) * 100);

  // モードに応じたラベルと色
  let label = "進行度:";
  let colorClass = "bg-blue-500";
  let textColorClass = "text-blue-400";

  if (kappaMode && !lightkeeperMode) {
    label = "κ進捗:";
    colorClass = "bg-orange-500";
    textColorClass = "text-orange-400";
  } else if (!kappaMode && lightkeeperMode) {
    label = "LK進捗:";
    colorClass = "bg-cyan-500";
    textColorClass = "text-cyan-400";
  } else if (kappaMode && lightkeeperMode) {
    label = "κ+LK進捗:";
    colorClass = "bg-purple-500";
    textColorClass = "text-purple-400";
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 text-sm mb-1">
        <span className={textColorClass}>{label}</span>
        <span className="text-white font-semibold">
          {completedCount} / {targetTasks.length}
        </span>
        <span className="text-gray-500">({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`${colorClass} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
