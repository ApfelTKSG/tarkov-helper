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
}

export default function TaskTreeView({ tasks, allTasks }: TaskTreeViewProps) {
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
          const parentTask = allTasks.find(t => t.id === req.task.id);
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
              onClick={() => toggleTaskComplete(task.id)}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${
                  isCompleted ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                <div className={`font-medium text-sm ${
                  isCompleted ? 'text-gray-500 line-through' : 'text-gray-900'
                }`}>
                  {task.name}
                </div>
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Lv.{task.minPlayerLevel} • +{task.experience.toLocaleString()} XP
              </div>
            </div>
          )
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          background: isCompleted ? '#f3f4f6' : '#ffffff',
          border: `2px solid ${
            isCompleted ? '#22c55e' : 
            task.taskRequirements.length === 0 ? '#10b981' : '#3b82f6'
          }`,
          borderRadius: '8px',
          padding: '12px',
          width: 280,
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
