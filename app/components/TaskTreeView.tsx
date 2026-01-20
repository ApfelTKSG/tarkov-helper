'use client';

import { useState } from 'react';
import { Task } from '../types/task';

interface TaskTreeViewProps {
  tasks: Task[];
  allTasks: Task[];
}

export default function TaskTreeView({ tasks, allTasks }: TaskTreeViewProps) {
  const [hoveredTask, setHoveredTask] = useState<string | null>(null);

  // このタスクを必要とする子タスクを取得
  const getChildTasks = (taskId: string) => {
    return tasks.filter(task => 
      task.taskRequirements.some(req => req.task.id === taskId)
    );
  };

  // ルートタスクを取得
  // 1. 依存関係がないタスク
  // 2. ルートタスクがない場合は、このトレーダー内で依存されていないタスク（他のトレーダーのタスクにのみ依存）
  let rootTasks = tasks.filter(task => task.taskRequirements.length === 0);
  
  if (rootTasks.length === 0) {
    // このトレーダー内のタスクIDセット
    const traderTaskIds = new Set(tasks.map(t => t.id));
    
    // このトレーダー内のタスクに依存していないタスク
    rootTasks = tasks.filter(task => {
      return !task.taskRequirements.some(req => traderTaskIds.has(req.task.id));
    });
    
    // それでも見つからない場合は、最小レベルのタスクを表示
    if (rootTasks.length === 0 && tasks.length > 0) {
      const minLevel = Math.min(...tasks.map(t => t.minPlayerLevel));
      rootTasks = tasks.filter(t => t.minPlayerLevel === minLevel);
    }
  }

  // タスクノードコンポーネント
  const TaskNode = ({ task, level = 0 }: { task: Task; level?: number }) => {
    const childTasks = getChildTasks(task.id);
    const hasChildren = childTasks.length > 0;
    const isHovered = hoveredTask === task.id;

    return (
      <div className="relative">
        {/* タスクノード */}
        <div className="flex items-start gap-3 mb-3">
          {/* 階層インデント */}
          {level > 0 && (
            <div className="flex items-center" style={{ width: `${level * 32}px` }}>
              <div className="w-full border-t-2 border-gray-600"></div>
            </div>
          )}
          
          {/* タスクボックス */}
          <div className="relative group">
            <div
              className={`bg-gray-700 rounded px-3 py-2 border-2 transition-all cursor-pointer ${
                task.taskRequirements.length === 0 
                  ? 'border-green-500' 
                  : 'border-blue-500'
              } ${isHovered ? 'ring-2 ring-yellow-400 scale-105' : ''}`}
              onMouseEnter={() => setHoveredTask(task.id)}
              onMouseLeave={() => setHoveredTask(null)}
            >
              <div className="text-sm font-medium text-white whitespace-nowrap">
                {task.name}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Lv.{task.minPlayerLevel}
              </div>
            </div>

            {/* ホバー時の詳細情報 */}
            {isHovered && (
              <div className="absolute left-0 top-full mt-2 z-50 bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-xl min-w-[300px] max-w-[400px]">
                <h4 className="text-lg font-bold text-white mb-3">{task.name}</h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">必要レベル:</span>
                    <span className="text-white">Lv.{task.minPlayerLevel}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">獲得経験値:</span>
                    <span className="text-yellow-400">+{task.experience.toLocaleString()} XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">目標数:</span>
                    <span className="text-white">{task.objectives.length}個</span>
                  </div>
                  {hasChildren && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">後続タスク:</span>
                      <span className="text-blue-400">{childTasks.length}個</span>
                    </div>
                  )}
                </div>

                {/* 前提タスク */}
                {task.taskRequirements.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <div className="text-xs text-gray-400 mb-1">前提タスク:</div>
                    <div className="text-sm text-blue-300">
                      {task.taskRequirements.map(req => req.task.name).join(', ')}
                    </div>
                  </div>
                )}

                {/* 目標リスト */}
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">目標:</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {task.objectives.map((obj, idx) => (
                      <div key={obj.id} className="text-xs text-gray-300">
                        {idx + 1}. {obj.description}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 子タスクを再帰的に表示 */}
        {hasChildren && (
          <div className="ml-8 border-l-2 border-gray-600 pl-0">
            {childTasks.map(childTask => (
              <TaskNode key={childTask.id} task={childTask} level={level + 1} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      {rootTasks.length > 0 ? (
        <div className="space-y-4">
          {rootTasks.map(task => (
            <TaskNode key={task.id} task={task} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500">このトレーダーにはルートタスクがありません</p>
      )}
    </div>
  );
}
