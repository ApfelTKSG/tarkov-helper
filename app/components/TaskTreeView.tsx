'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Task } from '../types/task';

interface TaskTreeViewProps {
  tasks: Task[];
  allTasks: Task[];
  traderName: string;
}

export default function TaskTreeView({ tasks, allTasks, traderName }: TaskTreeViewProps) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  // localStorageから完了状態を読み込み
  useEffect(() => {
    const saved = localStorage.getItem('tarkov-completed-tasks');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCompletedTasks(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse completed tasks:', e);
      }
    }
  }, []);

  // 完了状態をlocalStorageに保存
  const toggleTaskComplete = useCallback((taskId: string) => {
    setCompletedTasks((prev) => {
      const newCompleted = new Set(prev);
      if (newCompleted.has(taskId)) {
        newCompleted.delete(taskId);
      } else {
        newCompleted.add(taskId);
      }
      localStorage.setItem('tarkov-completed-tasks', JSON.stringify(Array.from(newCompleted)));
      return newCompleted;
    });
  }, []);

  // ノードとエッジを生成
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const taskLevels = new Map<string, number>();
    
    // 高速検索用のMap作成
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    
    // 各タスクの階層レベルを計算
    const calculateLevel = (task: Task, visited = new Set<string>()): number => {
      if (taskLevels.has(task.id)) {
        return taskLevels.get(task.id)!;
      }
      
      if (visited.has(task.id)) {
        return 0; // 循環参照防止
      }
      
      visited.add(task.id);
      
      if (task.taskRequirements.length === 0) {
        taskLevels.set(task.id, 0);
        return 0;
      }
      
      const maxParentLevel = Math.max(
        ...task.taskRequirements.map(req => {
          const parentTask = taskMap.get(req.task.id);
          return parentTask ? calculateLevel(parentTask, new Set(visited)) : -1;
        })
      );
      
      const level = maxParentLevel + 1;
      taskLevels.set(task.id, level);
      return level;
    };
    
    // 全タスクのレベルを計算
    tasks.forEach(task => calculateLevel(task));
    
    // レベルごとにタスクをグループ化
    const levelGroups = new Map<number, Task[]>();
    tasks.forEach(task => {
      const level = taskLevels.get(task.id) || 0;
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)!.push(task);
    });
    
    // ノードを作成
    tasks.forEach(task => {
      const level = taskLevels.get(task.id) || 0;
      const tasksInLevel = levelGroups.get(level) || [];
      const indexInLevel = tasksInLevel.indexOf(task);
      
      const isCompleted = completedTasks.has(task.id);
      
      // 未完了の前提タスクを取得
      const uncompletedRequirements = task.taskRequirements.filter(req => !completedTasks.has(req.task.id));
      const isLocked = uncompletedRequirements.length > 0;
      
      // 別トレーダーの前提タスクを抽出（Mapで高速検索）
      const crossTraderRequirements = uncompletedRequirements
        .map(req => {
          const fullTask = taskMap.get(req.task.id);
          return fullTask ? { ...req, task: fullTask } : null;
        })
        .filter((req): req is NonNullable<typeof req> => 
          req !== null && req.task.trader.name !== traderName
        );
      
      nodes.push({
        id: task.id,
        type: 'default',
        position: { 
          x: level * 350, 
          y: indexInLevel * 120 
        },
        data: { 
          label: (
            <div 
              onClick={() => !isLocked && toggleTaskComplete(task.id)}
              className={`${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {isLocked ? (
                  <div className="text-red-500 flex-shrink-0">🔒</div>
                ) : (
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-400'
                  }`}></div>
                )}
                <div className={`font-medium text-sm ${
                  isLocked ? 'text-gray-400' :
                  isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}>
                  {task.name}
                </div>
              </div>
              <div className={`text-xs mt-1 ${
                isLocked ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Lv.{task.minPlayerLevel} • +{task.experience.toLocaleString()} XP
              </div>
              {crossTraderRequirements.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <div className="text-xs font-semibold text-orange-600 mb-1">
                    他トレーダーの前提:
                  </div>
                  {crossTraderRequirements.map((req, idx) => (
                    <div 
                      key={idx} 
                      className="text-xs mb-0.5 text-orange-600 font-semibold"
                    >
                      <span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[10px] mr-1">
                        {req.task.trader.name}
                      </span>
                      {req.task.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: isLocked ? '#fef2f2' : isCompleted ? '#f3f4f6' : '#ffffff',
          border: `2px solid ${
            isLocked ? '#ef4444' :
            isCompleted ? '#22c55e' : 
            task.taskRequirements.length === 0 ? '#10b981' : '#3b82f6'
          }`,
          borderRadius: '8px',
          padding: '12px',
          width: 280,
          opacity: isLocked ? 0.6 : 1,
        },
      });
    });
    
    // エッジを作成
    tasks.forEach(task => {
      task.taskRequirements.forEach(req => {
        edges.push({
          id: `${req.task.id}-${task.id}`,
          source: req.task.id,
          target: task.id,
          type: 'smoothstep',
          animated: false,
          style: { 
            stroke: completedTasks.has(task.id) ? '#22c55e' : '#9ca3af',
            strokeWidth: 2
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: completedTasks.has(task.id) ? '#22c55e' : '#9ca3af',
          },
        });
      });
    });
    
    return { initialNodes: nodes, initialEdges: edges };
  }, [tasks, allTasks, completedTasks, toggleTaskComplete]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // completedTasksが変更されたらノードとエッジを更新
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="w-full h-[800px] bg-gray-900 rounded-lg border border-gray-700">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        attributionPosition="bottom-left"
      >
        <Controls className="bg-gray-800 border border-gray-600" />
        <Background color="#4b5563" gap={16} />
      </ReactFlow>
    </div>
  );
}
