'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  NodeProps,
  Handle,

  useReactFlow,
  ReactFlowProvider,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Task } from '../types/task';
import TaskDetailModal from './TaskDetailModal';
import { FirItemsData, TaskFirItem, FirItemDetail } from '../types/firItem';
import { traderNameToSlug } from '../lib/traderSlug';
import { getHideoutItems } from '../lib/data-loader';
import { useUserLevel } from '../context/UserLevelContext';
import { useFilterMode } from '../context/FilterModeContext';
import Image from 'next/image';

interface TaskTreeViewProps {
  tasks: Task[];
  allTasks: Task[];
  traderName: string;
  firItemsData?: FirItemsData;
  initialShowFirItems?: boolean;
}


interface TaskNodeData {
  task: Task;
  isCompleted: boolean;
  isLocked: boolean;
  levelLocked: boolean; // レベル不足によるロック
  userLevel: number;
  isCollectorRequirement: boolean;
  isLightkeeperRequirement: boolean;
  crossTraderRequirements: Array<{ task: Task }>;
  firItems?: TaskFirItem[];
  itemDetailsMap?: Map<string, FirItemDetail>;
  collectedFirItems: Map<string, number>;
  showFirItems: boolean;
  showFirOnly?: boolean;
  onToggleComplete: () => void;
  onIncrementFirItem: (taskId: string, itemId: string, maxCount: number) => void;
  onDecrementFirItem: (taskId: string, itemId: string) => void;
  onHover: (taskId: string | null) => void;
  onNavigateToTrader: (traderName: string, taskId: string) => void;
  onClick: () => void;
}

// カスタムタスクノードコンポーネント
const TaskNode = memo(({ data }: NodeProps<TaskNodeData>) => {
  const [isHovered, setIsHovered] = useState(false);
  const {
    task,
    isCompleted,
    isLocked,
    levelLocked,
    userLevel,
    isCollectorRequirement,
    isLightkeeperRequirement,
    crossTraderRequirements,
    firItems,
    itemDetailsMap,
    collectedFirItems,
    showFirItems,
    showFirOnly,
    onToggleComplete,
    onIncrementFirItem,
    onDecrementFirItem,
    onHover,
    onNavigateToTrader,
    onClick
  } = data;

  // FiRのみ表示フィルター
  const displayItems = showFirOnly && firItems
    ? firItems.filter((item: TaskFirItem) => item.isFirRequired)
    : firItems;

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        onClick={onClick}
        onMouseEnter={() => {
          setIsHovered(true);
          onHover(task.id);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          onHover(null);
        }}
        className={`${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'} relative group`}
        style={{
          background: (isLocked || levelLocked) ? '#fef2f2' :
            isCompleted ? '#f3f4f6' :
              task.type === 'hideout' ? '#faf5ff' : // Light purple for Hideout
                task.type === 'trader' ? '#eff6ff' : // Light blue for Trader
                  '#ffffff',
          border: `2px solid ${isHovered ? '#fbbf24' :
            isLocked ? '#ef4444' :
              levelLocked ? '#ef4444' :
                isCompleted ? '#22c55e' :
                  task.type === 'hideout' ? '#a855f7' : // Purple border
                    task.type === 'trader' ? '#3b82f6' : // Blue border
                      task.taskRequirements.length === 0 ? '#10b981' : '#3b82f6'
            }`,
          borderRadius: '8px',
          padding: '12px',
          width: 280,
          opacity: isLocked ? 0.6 : isCompleted ? 0.5 : 1, // Level Locked (only) stays Opacity 1
          boxShadow: isHovered ? '0 0 20px rgba(251, 191, 36, 0.6)' : 'none',
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'all 0.2s ease-in-out',
        }}
      >
        <div className="flex items-center gap-2 mb-1">

          {isLocked || levelLocked ? (
            <div className="flex items-center gap-1">
              <div className="text-red-500 font-bold flex-shrink-0">🔒</div>
            </div>
          ) : (
            task.type === 'hideout' ? (
              <div className="text-lg flex-shrink-0" title="Hideout Station">🏠</div>
            ) : task.type === 'trader' ? (
              <div className="text-lg flex-shrink-0" title="Trader Level">👑</div>
            ) : (
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isCompleted ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            )
          )}
          {isCollectorRequirement && (
            <div className="text-orange-500 font-bold text-xs flex-shrink-0 border border-orange-500 rounded px-1" title="Collectorタスクの前提">
              κ
            </div>
          )}
          {isLightkeeperRequirement && (
            <div className="text-cyan-500 font-bold text-xs flex-shrink-0 border border-cyan-500 rounded px-1" title="Getting Acquaintedタスクの前提">
              LK
            </div>
          )}
          <div
            className={`font-semibold text-sm ${isCompleted ? 'text-gray-500' : 'text-gray-900'
              }`}
          >
            {task.name}
            {task.type === 'hideout' && task.constructionTime && task.constructionTime > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">
                🕒 {Math.floor(task.constructionTime / 3600)}h {Math.floor((task.constructionTime % 3600) / 60)}m
              </span>
            )}
            {task.type === 'trader' && task.requiredReputation ? (
              <span className="ml-2 text-xs font-normal text-blue-600 block">
                Rep: {task.requiredReputation}
              </span>
            ) : null}
          </div>
        </div>

        {
          showFirItems && displayItems && displayItems.length > 0 && (
            <div className="flex-1 mt-2">
              <div className="space-y-1.5">
                {displayItems.slice(0, 6).map((item, idx) => {
                  const details = itemDetailsMap?.get(item.itemId);
                  const collectedCount = collectedFirItems.get(`${task.id}-${item.itemId}`) || 0;
                  const isFullyCollected = collectedCount >= item.count;
                  const showAsCollected = isFullyCollected || isCompleted;

                  return (
                    <div key={idx} className={`flex items-center gap-2 p-1 rounded border shadow-sm ${showAsCollected ? 'bg-green-100 border-green-300' : 'bg-gray-100/80 border-gray-200'}`}>
                      {details?.iconLink && (
                        <div className="relative w-6 h-6 flex-shrink-0 bg-white rounded border border-gray-300">
                          {showAsCollected && (
                            <div className="absolute inset-0 bg-green-500/50 z-10 flex items-center justify-center rounded">
                              <span className="text-white font-bold text-xs">✓</span>
                            </div>
                          )}
                          <Image
                            src={details.iconLink}
                            alt={item.itemName}
                            fill
                            className="object-contain p-0.5"
                            unoptimized
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex justify-between items-center pr-1">
                        <div className={`text-[11px] font-bold truncate leading-tight mr-1 flex-1 ${showAsCollected ? 'text-green-800 decoration-green-800' : 'text-gray-800'}`} title={item.itemName}>
                          {item.itemShortName || item.itemName}
                        </div>

                        {/* Counter Controls */}
                        <div className="flex items-center gap-0.5 bg-white/50 rounded border border-gray-300 px-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCompleted) {
                                onDecrementFirItem(task.id, item.itemId);
                              }
                            }}
                            disabled={isCompleted || collectedCount === 0}
                            className={`w-4 h-4 flex items-center justify-center text-[10px] rounded hover:bg-red-100 transition-colors ${isCompleted || collectedCount === 0 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 font-bold'}`}
                          >
                            −
                          </button>
                          <span className={`text-[9px] font-bold min-w-[20px] text-center ${isFullyCollected
                            ? 'text-green-600'
                            : collectedCount > 0
                              ? 'text-yellow-600'
                              : 'text-gray-500'
                            }`}>
                            {collectedCount}/{item.count}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!isCompleted) {
                                onIncrementFirItem(task.id, item.itemId, item.count);
                              }
                            }}
                            disabled={isCompleted || isFullyCollected}
                            className={`w-4 h-4 flex items-center justify-center text-[10px] rounded hover:bg-green-100 transition-colors ${isCompleted || isFullyCollected ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 font-bold'}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {displayItems && displayItems.length > 6 && (
                  <div className="text-[10px] text-gray-500 text-center font-medium bg-gray-100 rounded py-0.5">
                    + 他 {displayItems.length - 6} アイテム...
                  </div>
                )}
                <div className="text-[10px] text-blue-600 text-center mt-1 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  クリックして詳細・チェック
                </div>
              </div>
            </div>
          )
        }

        <div className={`text-xs font-mono mt-2 text-right ${levelLocked ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
          {levelLocked && !isLocked && <span className="mr-1">⚠️</span>}Req Lv.{task.minPlayerLevel > 0 ? task.minPlayerLevel : 1}
        </div>
        {
          crossTraderRequirements.length > 0 && (
            <div className="mt-2 pt-2 border-t border-orange-200">
              <div className="text-xs font-semibold text-orange-700 mb-1">他トレーダーの前提:</div>
              {crossTraderRequirements.slice(0, 2).map((req, idx) => (
                <div
                  key={idx}
                  className="text-xs mb-0.5 text-orange-600 font-semibold hover:underline cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigateToTrader(req.task.trader.name, req.task.id);
                  }}
                  title={`${req.task.trader.name}のページへ移動`}
                >
                  <span className="bg-orange-500 text-white px-1 py-0.5 rounded text-[10px] mr-1">
                    {req.task.trader.name}
                  </span>
                  {req.task.name}
                </div>
              ))}
              {crossTraderRequirements.length > 2 && (
                <div className="text-xs text-orange-600 font-semibold mt-1">
                  + 他 {crossTraderRequirements.length - 2} タスク
                </div>
              )}
            </div>
          )
        }
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </>
  );
});

TaskNode.displayName = 'TaskNode';

const nodeTypes = {
  taskNode: TaskNode,
};



function TaskTreeViewInner({ tasks, allTasks, traderName, firItemsData, initialShowFirItems }: TaskTreeViewProps) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  // User Level Context
  const { userLevel, setUserLevel } = useUserLevel();
  const { kappaMode, setKappaMode, lightkeeperMode, setLightkeeperMode } = useFilterMode();
  const { fitView, getNode } = useReactFlow();

  // Map<taskId-itemId, count> で個数管理
  const [collectedFirItems, setCollectedFirItems] = useState<Map<string, number>>(new Map());
  const [showFirOnly, setShowFirOnly] = useState(false);
  const [hideStash, setHideStash] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('tarkov-fir-collected');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 配列形式 [[key, count], ...] から Mapを構築
        // 旧形式 (配列の配列でない場合) の互換性チェックは今回は省略し、Mapとしてロード
        setCollectedFirItems(new Map(parsed));
      } catch (e) {
        console.error('Failed to parse collected fir items:', e);
      }
    }
  }, []);

  // アイテム数をインクリメント
  const incrementFirItemCount = useCallback((taskId: string, itemId: string, maxCount: number) => {
    const key = `${taskId}-${itemId}`;
    setCollectedFirItems((prev) => {
      const newMap = new Map(prev);
      const currentCount = newMap.get(key) || 0;
      const newCount = Math.min(currentCount + 1, maxCount);
      newMap.set(key, newCount);
      localStorage.setItem('tarkov-fir-collected', JSON.stringify(Array.from(newMap.entries())));
      return newMap;
    });
  }, []);

  // アイテム数をデクリメント
  const decrementFirItemCount = useCallback((taskId: string, itemId: string) => {
    const key = `${taskId}-${itemId}`;
    setCollectedFirItems((prev) => {
      const newMap = new Map(prev);
      const currentCount = newMap.get(key) || 0;
      if (currentCount <= 1) {
        newMap.delete(key);
      } else {
        newMap.set(key, currentCount - 1);
      }
      localStorage.setItem('tarkov-fir-collected', JSON.stringify(Array.from(newMap.entries())));
      return newMap;
    });
  }, []);




  // FiRデータのマップ作成
  const firItemsMap = useMemo(() => {
    let map = new Map();
    if (firItemsData) {
      map = new Map(firItemsData.itemsByTask.map(t => [t.taskId, t.firItems]));
    }

    // Hideout items
    if (traderName === 'Hideout') {
      const { items } = getHideoutItems();
      items.forEach(t => {
        map.set(t.taskId, t.firItems);
      });
    }

    return map;
  }, [firItemsData, traderName]);

  const itemDetailsMap = useMemo(() => {
    const map = new Map<string, FirItemDetail>();
    if (firItemsData) {
      firItemsData.itemsIndex.forEach(item => {
        map.set(item.id, item);
      });
    }

    if (traderName === 'Hideout') {
      const { details } = getHideoutItems();
      details.forEach(item => {
        if (!map.has(item.id)) {
          map.set(item.id, item);
        }
      });
    }

    return map;
  }, [firItemsData, traderName]);


  // localStorageから完了状態を読み込み
  useEffect(() => {
    // Load completed tasks
    const savedTasks = localStorage.getItem('tarkov-completed-tasks');
    if (savedTasks) {
      try {
        const parsed = JSON.parse(savedTasks);
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

  // すべての依存タスクを再帰的に取得
  const getAllRequiredTasks = useCallback((taskId: string, visited = new Set<string>()): string[] => {
    if (visited.has(taskId)) {
      return [];
    }
    visited.add(taskId);

    const task = allTasks.find(t => t.id === taskId);
    if (!task) {
      return [];
    }

    const requiredTaskIds: string[] = [taskId];

    task.taskRequirements.forEach(req => {
      const subRequirements = getAllRequiredTasks(req.task.id, visited);
      requiredTaskIds.push(...subRequirements);
    });

    return requiredTaskIds;
  }, [allTasks]);

  // タスクとすべての依存タスクを強制的に完了にする
  const forceCompleteTask = useCallback((taskId: string) => {
    const allRequiredTaskIds = getAllRequiredTasks(taskId);

    // Lvも上げる処理
    const targetTask = allTasks.find(t => t.id === taskId);
    if (targetTask && targetTask.minPlayerLevel > userLevel) {
      setUserLevel(targetTask.minPlayerLevel);
    }

    setCompletedTasks((prev) => {
      const newCompleted = new Set(prev);
      allRequiredTaskIds.forEach(id => newCompleted.add(id));
      localStorage.setItem('tarkov-completed-tasks', JSON.stringify(Array.from(newCompleted)));
      return newCompleted;
    });
  }, [getAllRequiredTasks, allTasks, userLevel, setUserLevel]);

  // ノードとエッジを生成
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const taskLevels = new Map<string, number>();

    // 高速検索用のMap作成
    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    // Kappa必須タスク（Collectorの前提タスク）を再帰的に特定
    const kappaRequiredTaskIds = new Set<string>();

    // Collectorタスクを探す（通常はFenceのタスク）
    const collectorTask = allTasks.find(t => t.name === 'Collector' || t.isCollectorRequirement === true);
    // データ構造上 isCollectorRequirement は「Collectorの前提である」という意味で使われていることが多いが、
    // ここでは念のため、明示的にフラグが立っているもの + その前提タスク を収集する。

    // isCollectorRequirement=true のタスクを起点に、その前提タスクを全て収集
    const collectRequirements = (taskId: string, visited = new Set<string>()) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      kappaRequiredTaskIds.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      task.taskRequirements.forEach(req => {
        collectRequirements(req.task.id, visited);
      });
    };

    allTasks.forEach(t => {
      if (t.isCollectorRequirement) {
        collectRequirements(t.id);
      }
    });

    // Lightkeeper必須タスク (Getting Acquaintedの前提タスク)
    const lightkeeperRequiredTaskIds = new Set<string>();

    // isLightkeeperRequirement=true のタスクを起点に収集
    const collectLightkeeperRequirements = (taskId: string, visited = new Set<string>()) => {
      if (visited.has(taskId)) return;
      visited.add(taskId);
      lightkeeperRequiredTaskIds.add(taskId);

      const task = taskMap.get(taskId);
      if (!task) return;

      task.taskRequirements.forEach(req => {
        collectLightkeeperRequirements(req.task.id, visited);
      });
    };

    allTasks.forEach(t => {
      if (t.isLightkeeperRequirement) {
        collectLightkeeperRequirements(t.id);
      }
    });

    // 表示対象のタスクをフィルタリング
    // KappaモードとLightkeeperモードは独立して動作 (両方ONなら両方のタスクを表示)
    // ただし、Hideoutでは常に全タスクを表示
    let visibleTasks = tasks;

    if ((kappaMode || lightkeeperMode) && traderName !== 'Hideout') {
      visibleTasks = tasks.filter(t => {
        const isKappa = kappaMode && kappaRequiredTaskIds.has(t.id);
        const isLightkeeper = lightkeeperMode && lightkeeperRequiredTaskIds.has(t.id);

        // どちらか一方でもモードがONで、かつその条件を満たすなら表示
        if (kappaMode && !lightkeeperMode) return isKappa;
        if (!kappaMode && lightkeeperMode) return isLightkeeper;
        if (kappaMode && lightkeeperMode) return isKappa || isLightkeeper;

        return false;
      });
    }

    // Hideoutでの追加フィルター: FiRのみ表示
    if (traderName === 'Hideout' && showFirOnly) {
      visibleTasks = visibleTasks.filter(task => {
        const firItems = firItemsMap.get(task.id);
        return firItems && firItems.some((item: TaskFirItem) => item.isFirRequired);
      });
    }

    // Hideoutでの追加フィルター: Stash非表示
    if (traderName === 'Hideout' && hideStash) {
      visibleTasks = visibleTasks.filter(task => !task.name.includes('Stash'));
    }

    const traderTaskIds = new Set(visibleTasks.map(t => t.id));

    // 各タスクの深さレベルを計算（そのトレーダー内の前提タスクからの距離）
    const taskDepths = new Map<string, number>();

    const calculateDepth = (task: Task, visited = new Set<string>()): number => {
      if (taskDepths.has(task.id)) {
        return taskDepths.get(task.id)!;
      }

      if (visited.has(task.id)) {
        return 0; // 循環参照防止
      }

      visited.add(task.id);

      // このトレーダー内の前提タスクを取得
      const traderRequirements = task.taskRequirements.filter(req =>
        traderTaskIds.has(req.task.id)
      );

      if (traderRequirements.length === 0) {
        // このトレーダー内に前提タスクがない = 0番目
        taskDepths.set(task.id, 0);
        return 0;
      }

      // 前提タスクの中で最も深いものを探す
      const parentDepths = traderRequirements.map(req => {
        const parentTask = taskMap.get(req.task.id);
        if (!parentTask) {
          return -1;
        }
        return calculateDepth(parentTask, new Set(visited));
      }).filter(depth => depth >= 0);

      const maxParentDepth = parentDepths.length > 0 ? Math.max(...parentDepths) : -1;
      const depth = maxParentDepth + 1;
      taskDepths.set(task.id, depth);
      return depth;
    };

    // 全タスクの深さを計算
    visibleTasks.forEach(task => calculateDepth(task));

    // 深さをレベルとして使用
    visibleTasks.forEach(task => {
      const depth = taskDepths.get(task.id) || 0;
      taskLevels.set(task.id, depth);
    });

    const levels = visibleTasks.map(task => taskLevels.get(task.id) || 0);
    const uniqueLevels = Array.from(new Set(levels)).sort((a, b) => a - b);
    const levelMapping = new Map(uniqueLevels.map((level, index) => [level, index]));

    // タスクの位置を計算（前提タスクと同じ高さに配置）
    const taskPositions = new Map<string, { x: number; y: number }>();
    const levelYPositions = new Map<number, number[]>(); // 各レベルで使用中のY座標

    // レベルごとにタスクをソート（処理順序を決定）
    const levelGroups = new Map<number, Task[]>();
    visibleTasks.forEach(task => {
      const originalLevel = taskLevels.get(task.id) || 0;
      const adjustedLevel = levelMapping.get(originalLevel) || 0;
      if (!levelGroups.has(adjustedLevel)) {
        levelGroups.set(adjustedLevel, []);
      }
      levelGroups.get(adjustedLevel)!.push(task);
    });

    // レベル順に位置を決定
    uniqueLevels.forEach((originalLevel, levelIndex) => {
      const level = levelMapping.get(originalLevel) || 0;
      const tasksInLevel = levelGroups.get(level) || [];

      // 前提タスクのY座標の最小値でソート（処理順序）
      tasksInLevel.sort((a, b) => {
        const aRequirements = a.taskRequirements.filter(req => traderTaskIds.has(req.task.id));
        const bRequirements = b.taskRequirements.filter(req => traderTaskIds.has(req.task.id));

        const aCenterY = aRequirements.length > 0
          ? aRequirements.reduce((sum, req) => sum + (taskPositions.get(req.task.id)?.y || 0), 0) / aRequirements.length
          : Infinity;

        const bCenterY = bRequirements.length > 0
          ? bRequirements.reduce((sum, req) => sum + (taskPositions.get(req.task.id)?.y || 0), 0) / bRequirements.length
          : Infinity;

        if (aCenterY === Infinity && bCenterY === Infinity) {
          return a.id.localeCompare(b.id);
        }
        return aCenterY - bCenterY;
      });

      // 積み上げ配置用変数
      let lastBottom = -Infinity;

      tasksInLevel.forEach(task => {
        const xPos = level * 350;

        // --- 高さ推定ロジック ---
        let estimatedHeight = 150; // デフォルト最小高さ

        if (true) {
          // 基本ヘッダー・パディング等: 80px
          // FiRアイテム
          const items = firItemsMap.get(task.id) || [];
          const visibleItemCount = Math.min(items.length, 6);
          const hasMoreItems = items.length > 6;
          // 1アイテムあたり36px
          const itemsHeight = (visibleItemCount * 36) + (hasMoreItems ? 24 : 0);

          // "クリックして詳細/FiR不要" エリア
          const footerHeight = 24;

          // 他トレーダー要件 (crossTraderRequirements)
          const uncompletedReqs = task.taskRequirements.filter(r => !completedTasks.has(r.task.id));
          const crossReqs = uncompletedReqs.filter(r => {
            const t = taskMap.get(r.task.id);
            return t && t.trader.name !== traderName;
          });
          const crossReqHeight = crossReqs.length > 0
            ? (Math.min(crossReqs.length, 2) * 24 + 40) // タイトル + リスト
            : 0;

          // 合計 (ベース + アイテム + フッター + クロス要件 + マージン)
          estimatedHeight = 80 + itemsHeight + footerHeight + crossReqHeight + 20;

          // ノードの実際のスタイル(padding等)を考慮し、最低値を確保
          if (items.length === 0) estimatedHeight = Math.max(estimatedHeight, 100);
        } else {
          // FiR非表示モード時はシンプル
          const uncompletedReqs = task.taskRequirements.filter(r => !completedTasks.has(r.task.id));
          const crossReqs = uncompletedReqs.filter(r => taskMap.get(r.task.id)?.trader.name !== traderName);
          if (crossReqs.length > 0) {
            estimatedHeight = 150 + (Math.min(crossReqs.length, 2) * 24);
          }
        }

        // --- 理想のY座標（親の平均位置） ---
        const traderRequirements = task.taskRequirements.filter(req =>
          traderTaskIds.has(req.task.id)
        );

        let desiredY = 0;
        if (traderRequirements.length > 0) {
          const parentYPositions = traderRequirements
            .map(req => taskPositions.get(req.task.id)?.y)
            .filter((y): y is number => y !== undefined);

          if (parentYPositions.length > 0) {
            desiredY = parentYPositions.reduce((sum, y) => sum + y, 0) / parentYPositions.length;
          }
        } else {
          // 親がない場合
          desiredY = lastBottom === -Infinity ? 0 : lastBottom + 40;
        }

        // --- 配置決定 (積み上げ) ---
        const MIN_GAP = 40; // ノード間の最低隙間
        let actualY = desiredY;

        // もし理想位置が、直前のタスクに被るなら押し下げる
        if (lastBottom > -Infinity) {
          if (actualY < lastBottom + MIN_GAP) {
            actualY = lastBottom + MIN_GAP;
          }
        }

        taskPositions.set(task.id, { x: xPos, y: actualY });
        lastBottom = actualY + estimatedHeight;
      });
    });

    // ノードを作成
    visibleTasks.forEach(task => {
      const position = taskPositions.get(task.id) || { x: 0, y: 0 };

      const isCompleted = completedTasks.has(task.id);
      const isCollectorRequirement = task.isCollectorRequirement || false;
      const isLightkeeperRequirement = task.isLightkeeperRequirement || false;

      // 未完了の前提タスクを取得
      const uncompletedRequirements = task.taskRequirements.filter(req => !completedTasks.has(req.task.id));
      const hasReqLock = uncompletedRequirements.length > 0;
      const levelLocked = task.minPlayerLevel > userLevel;
      const isLocked = hasReqLock; // 従来のロック（前提タスク）

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
        type: 'taskNode',
        position,
        data: {
          task,
          isCompleted,
          isLocked,
          levelLocked,
          userLevel,
          isCollectorRequirement,
          isLightkeeperRequirement,
          crossTraderRequirements,
          firItems: firItemsMap.get(task.id),
          itemDetailsMap,
          collectedFirItems,
          showFirItems: true, // TODO: Toggle button for this?
          showFirOnly: traderName === 'Hideout' ? showFirOnly : false,
          onToggleComplete: () => !isLocked && toggleTaskComplete(task.id),
          onIncrementFirItem: incrementFirItemCount,
          onDecrementFirItem: decrementFirItemCount,
          onHover: setHoveredTaskId,
          onNavigateToTrader: (traderName: string, taskId: string) => {
            const basePath = process.env.NODE_ENV === 'production' ? '/tarkov-helper' : '';
            const traderSlug = traderNameToSlug(traderName);
            window.location.href = `${basePath}/traders/${traderSlug}?taskId=${taskId}`;
          },
          onClick: () => setSelectedTask(task),
        } as TaskNodeData,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        style: {
          width: 280,
        },
      });
    });

    // 祖先タスクを再帰的に収集する関数
    const collectAncestors = (taskId: string, visited = new Set<string>()): Set<string> => {
      if (visited.has(taskId)) return visited;
      visited.add(taskId);

      const task = visibleTasks.find(t => t.id === taskId);
      if (!task) return visited;

      // このトレーダー内の前提タスクのみを対象
      const traderRequirements = task.taskRequirements.filter(req => traderTaskIds.has(req.task.id));

      traderRequirements.forEach(req => {
        collectAncestors(req.task.id, visited);
      });

      return visited;
    };

    // エッジを作成
    visibleTasks.forEach(task => {
      task.taskRequirements.forEach(req => {
        // 表示対象でないタスクからのエッジは無視（ただしクロスリファレンスは別）
        // ソースタスクが表示対象に含まれているか、または別トレーダーのタスクか
        const isSourceVisible = traderTaskIds.has(req.task.id) || taskMap.get(req.task.id)?.trader.name !== traderName;

        if (!isSourceVisible) return;

        const isCompleted = completedTasks.has(task.id);
        const isSourceCompleted = completedTasks.has(req.task.id);

        // 別トレーダーのタスクかチェック
        const sourceTask = taskMap.get(req.task.id);
        const isCrossTrader = sourceTask && sourceTask.trader.name !== traderName;

        // ホバー時の強調表示判定
        let isHighlighted = false;
        let shouldDimOthers = false;
        if (hoveredTaskId) {
          const hoveredTask = visibleTasks.find(t => t.id === hoveredTaskId);
          if (hoveredTask) {
            const isHoveredCompleted = completedTasks.has(hoveredTaskId);
            const isHoveredLocked = hoveredTask.taskRequirements.filter(r => !completedTasks.has(r.task.id)).length > 0;

            // 後続タスクがあるかチェック
            const hasChildTasks = visibleTasks.some(t =>
              t.taskRequirements.some(r => r.task.id === hoveredTaskId)
            );

            if (!isHoveredCompleted) {
              if (isHoveredLocked) {
                // ロックされているタスク: このトレーダー内に前提タスクがあるかチェック
                const hasTraderRequirements = hoveredTask.taskRequirements.some(r => {
                  const reqTask = taskMap.get(r.task.id);
                  return reqTask && reqTask.trader.name === traderName && !completedTasks.has(r.task.id);
                });

                if (hasTraderRequirements) {
                  // すべての祖先タスクとそのエッジを強調
                  shouldDimOthers = true;
                  const ancestors = collectAncestors(hoveredTaskId);
                  // このエッジのsourceとtargetが両方とも祖先に含まれているか
                  if (ancestors.has(task.id) && ancestors.has(req.task.id)) {
                    isHighlighted = true;
                  }
                }
                // 他トレーダーのタスクのみでロックされている場合は shouldDimOthers = false
              } else if (hasChildTasks) {
                // アンロックされていて後続タスクがある: 後続タスクへの矢印を強調
                shouldDimOthers = true;
                if (req.task.id === hoveredTaskId && task.id) {
                  isHighlighted = true;
                }
              }
              // 後続タスクがない場合は shouldDimOthers = false のまま
            }
          }
        }

        edges.push({
          id: `${req.task.id}-${task.id}`,
          source: req.task.id,
          target: task.id,
          type: 'default',
          animated: isHighlighted || (!isCompleted && !isSourceCompleted),
          style: {
            stroke: isHighlighted ? '#fbbf24' :
              isCrossTrader ? '#f97316' :
                isCompleted ? '#22c55e' :
                  isSourceCompleted ? '#60a5fa' :
                    '#64748b',
            strokeWidth: isHighlighted ? 5 : 3,
            opacity: shouldDimOthers && !isHighlighted ? 0.3 : 1,
            transition: 'all 0.2s ease-in-out',
          },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [tasks, allTasks, completedTasks, toggleTaskComplete, traderName, hoveredTaskId, kappaMode, lightkeeperMode, firItemsData, firItemsMap, itemDetailsMap, collectedFirItems, showFirOnly, hideStash]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // completedTasksが変更されたらノードとエッジを更新
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // URLパラメータからタスクIDを取得してフォーカス
  useEffect(() => {
    // クライアントサイドでのみ実行
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const taskId = url.searchParams.get('taskId');

    if (taskId) {
      // 少し遅延させてからフォーカス（ノードのレンダリング完了を待つ）
      const timeoutId = setTimeout(() => {
        const node = getNode(taskId);

        if (node) {
          fitView({
            nodes: [{ id: taskId }],
            duration: 800,
            padding: 0.5,
            maxZoom: 1,
          });

          // フォーカス後、URLパラメータを削除
          url.searchParams.delete('taskId');
          window.history.replaceState({}, '', url.pathname + url.search);
        }
      }, 300);

      return () => clearTimeout(timeoutId);
    }
  }, [fitView, getNode]);

  return (
    <>
      <div className="relative w-full h-full bg-gray-900 rounded-lg border border-gray-700">
        <style jsx global>{`
          .react-flow__edge {
            pointer-events: none !important;
          }
        `}</style>

        {/* Toggle Buttons Container */}
        {traderName !== 'Hideout' && (
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            {/* Kappaモードトグルボタン */}
            <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-lg">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm font-bold text-orange-400 mr-1 w-16 text-right">κ Mode</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={kappaMode}
                    onChange={(e) => setKappaMode(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </div>
              </label>
            </div>

            {/* Lightkeeperモードトグルボタン */}
            <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-lg">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-sm font-bold text-cyan-400 mr-1 w-16 text-right">LK Mode</span>
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={lightkeeperMode}
                    onChange={(e) => setLightkeeperMode(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Hideout用ボタン */}
        {traderName === 'Hideout' && (
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
            <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-lg">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideStash}
                  onChange={(e) => setHideStash(e.target.checked)}
                  className="w-4 h-4 text-purple-500 rounded focus:ring-purple-500 bg-gray-700 border-gray-500"
                />
                <span className="text-sm text-gray-300 flex items-center gap-1">
                  <span className="text-lg">📦</span>
                  Stash非表示
                </span>
              </label>
            </div>

            <div className="bg-gray-800 p-2 rounded-lg border border-gray-700 shadow-lg">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showFirOnly}
                  onChange={(e) => setShowFirOnly(e.target.checked)}
                  className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500 bg-gray-700 border-gray-500"
                />
                <span className="text-sm text-gray-300">FiRのみ表示</span>
              </label>
            </div>
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          defaultViewport={{ x: 0, y: 0, zoom: 0.6 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#4b5563" gap={16} />
        </ReactFlow>
      </div>

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          allTasks={allTasks}
          isOpen={true}
          onClose={() => setSelectedTask(null)}
          onToggleComplete={() => {
            toggleTaskComplete(selectedTask.id);
          }}
          onForceComplete={() => {
            forceCompleteTask(selectedTask.id);
          }}
          isCompleted={completedTasks.has(selectedTask.id)}
          isLocked={selectedTask.taskRequirements.some(req => !completedTasks.has(req.task.id))}
          firItems={firItemsMap.get(selectedTask.id)}
          itemDetailsMap={itemDetailsMap}
          onNavigateToTrader={(traderName: string, taskId: string) => {
            const basePath = process.env.NODE_ENV === 'production' ? '/tarkov-helper' : '';
            const traderSlug = traderNameToSlug(traderName);
            window.location.href = `${basePath}/traders/${traderSlug}?taskId=${taskId}`;
          }}
          collectedFirItems={collectedFirItems}
          onIncrementFirItem={incrementFirItemCount}
          onDecrementFirItem={decrementFirItemCount}
          completedTasks={completedTasks}
          showFirOnly={showFirOnly}
        />
      )}
    </>
  );
}

export default function TaskTreeView(props: TaskTreeViewProps) {
  return (
    <ReactFlowProvider>
      <TaskTreeViewInner {...props} />
    </ReactFlowProvider>
  );
}
