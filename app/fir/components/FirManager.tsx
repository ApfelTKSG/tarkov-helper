'use strict';
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { FirItemsData, FirItemDetail } from '@/app/types/firItem';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import Link from 'next/link';
import { useFilterMode } from '@/app/context/FilterModeContext';
import { useUserLevel } from '@/app/context/UserLevelContext';

interface FirManagerProps {
    firData: FirItemsData;
    filterMode?: 'all' | 'exclude-collector' | 'collector-only' | 'hideout-only';
}

interface ItemStatus {
    item: FirItemDetail;
    totalNeeded: number;
    remainingNeeded: number;
    minReqLevel: number; // 最低要求レベル（未完了タスクの中で）
    hasActiveTask: boolean; // 受注可能（レベル到達＆未完了）なタスクがあるか
    minDependencies: number; // Hideout: 関連タスクの最小依存数
    relatedTasks: Array<{
        taskId: string;
        taskName: string;
        trader: string;
        count: number;
        isCompleted: boolean;
        isCollectorRequirement?: boolean;
        isLightkeeperRequirement?: boolean;
        minPlayerLevel: number;
        collectedCount: number; // 収集済み個数
        dependencyCount?: number; // Hideoutタスクの依存数
    }>;
}

type SortOption = 'default' | 'count-desc' | 'count-asc' | 'level-asc';

export default function FirManager({ firData, filterMode = 'all' }: FirManagerProps) {
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showCompleted, setShowCompleted] = useState(true);
    // Global Filter State
    const { kappaMode, setKappaMode, lightkeeperMode, setLightkeeperMode } = useFilterMode();
    const { userLevel } = useUserLevel();

    // Local Filter/Sort State
    // Map<taskId-itemId, count> で個数管理
    const [collectedFirItems, setCollectedFirItems] = useState<Map<string, number>>(new Map());

    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [sortOption, setSortOption] = useState<SortOption>('default');
    const [onlyActive, setOnlyActive] = useState(false); // 現在受注可能なタスクのみ

    // Load completed tasks from localStorage
    useEffect(() => {
        const savedTasks = localStorage.getItem('tarkov-completed-tasks');
        if (savedTasks) {
            try {
                const parsed = JSON.parse(savedTasks);
                setCompletedTasks(new Set(parsed));
            } catch (e) {
                console.error('Failed to parse completed tasks:', e);
            }
        }

        // Load collected fir items (Map形式でロード)
        const savedFirItems = localStorage.getItem('tarkov-fir-collected');
        if (savedFirItems) {
            try {
                const parsed = JSON.parse(savedFirItems);
                // 配列形式 [[key, count], ...] から Mapを構築
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

    // Process items data based on completed tasks
    const processedItems: ItemStatus[] = useMemo(() => {
        return firData.itemsIndex.map((item) => {
            const relatedTasks = item.requiredByTasks.map((req) => {
                // Hideoutタスクの依存数を取得
                const taskData = firData.itemsByTask.find(t => t.taskId === req.taskId);
                const dependencyCount = taskData?.dependencyCount ?? taskData?.taskRequirements?.length ?? 0;

                const collectedCount = collectedFirItems.get(`${req.taskId}-${item.id}`) || 0;

                return {
                    taskId: req.taskId,
                    taskName: req.taskName,
                    trader: req.trader,
                    count: req.count,
                    isCompleted: completedTasks.has(req.taskId),
                    isCollectorRequirement: req.isCollectorRequirement,
                    isLightkeeperRequirement: req.isLightkeeperRequirement,
                    minPlayerLevel: req.minPlayerLevel,
                    collectedCount, // 収集済み個数
                    dependencyCount,
                };
            }).filter(task => {
                // 基本フィルター（除外ロジック）
                const isHideoutTask = task.trader === 'Hideout';

                if (filterMode === 'hideout-only') {
                    if (!isHideoutTask) return false;
                } else if (filterMode === 'collector-only') {
                    if (task.taskName !== 'Collector') return false;
                } else if (filterMode === 'exclude-collector') {
                    if (task.taskName === 'Collector') return false;
                    // 通常モードではハイドアウトも除外（別枠管理のため）
                    if (isHideoutTask) return false;
                }

                // モードフィルター（包含ロジック）
                // どちらかのモードがオンの場合、そのモードの条件を満たすタスクのみを表示する
                // ただし、Hideoutモードのときは適用しない
                const isModeActive = (kappaMode || lightkeeperMode) && filterMode !== 'hideout-only';
                if (isModeActive) {
                    const matchesKappa = kappaMode && task.isCollectorRequirement;
                    const matchesLK = lightkeeperMode && task.isLightkeeperRequirement;

                    // どちらかの条件に合致すればOK
                    if (!matchesKappa && !matchesLK) return false;
                }

                return true;
            });

            const totalNeeded = relatedTasks.reduce((sum, task) => sum + task.count, 0);
            const remainingNeeded = relatedTasks.reduce(
                (sum, task) => {
                    if (task.isCompleted) return sum;
                    const remaining = Math.max(0, task.count - task.collectedCount);
                    return sum + remaining;
                },
                0
            );

            // 未完了タスクの中で最も低い要求レベルを取得
            const uncompletedTasks = relatedTasks.filter(t => !t.isCompleted);
            const minReqLevel = uncompletedTasks.length > 0
                ? Math.min(...uncompletedTasks.map(t => t.minPlayerLevel))
                : 99;

            // 受注可能（レベル到達＆未完了）なタスクがあるか
            const hasActiveTask = uncompletedTasks.some(t => t.minPlayerLevel <= userLevel);

            // Hideout: 関連タスクの最小依存数
            const minDependencies = relatedTasks.length > 0
                ? Math.min(...relatedTasks.map(t => t.dependencyCount || 0))
                : 99;

            return {
                item,
                totalNeeded,
                remainingNeeded,
                minReqLevel,
                hasActiveTask,
                minDependencies,
                relatedTasks,
            };
        })
            .filter(status => status.totalNeeded > 0); // ここでのソートは削除し、filteredItemsで行う
    }, [firData, firData.itemsIndex, completedTasks, filterMode, kappaMode, lightkeeperMode, userLevel, collectedFirItems]);

    // Filter and Sort items
    const filteredItems = useMemo(() => {
        let result = processedItems.filter((status) => {
            // Search filter
            const matchesSearch =
                searchQuery === '' ||
                status.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                status.item.shortName.toLowerCase().includes(searchQuery.toLowerCase());

            // Completion filter
            const matchesCompletion = showCompleted || status.remainingNeeded > 0;

            // Active (Unlocked) filter
            const matchesActive = !onlyActive || status.hasActiveTask;

            return matchesSearch && matchesCompletion && matchesActive;
        });

        // Sort items
        return result.sort((a, b) => {
            switch (sortOption) {
                case 'count-desc':
                    return b.remainingNeeded - a.remainingNeeded || b.totalNeeded - a.totalNeeded;
                case 'count-asc':
                    return a.remainingNeeded - b.remainingNeeded || a.totalNeeded - b.totalNeeded;
                case 'level-asc':
                    // レベルが低い順。完了済み(99)は後ろに
                    return a.minReqLevel - b.minReqLevel || b.remainingNeeded - a.remainingNeeded;
                case 'default':
                default:
                    // Hideout mode: 依存数が少ない順 -> 残り必要数が多い順
                    if (filterMode === 'hideout-only') {
                        if (a.minDependencies !== b.minDependencies) {
                            return a.minDependencies - b.minDependencies;
                        }
                        if (a.remainingNeeded !== b.remainingNeeded) {
                            return b.remainingNeeded - a.remainingNeeded;
                        }
                        return b.totalNeeded - a.totalNeeded;
                    }

                    // Default: Min Level (Asc) -> Remaining Needed (Desc)
                    if (a.minReqLevel !== b.minReqLevel) {
                        return a.minReqLevel - b.minReqLevel;
                    }
                    if (a.remainingNeeded !== b.remainingNeeded) {
                        return b.remainingNeeded - a.remainingNeeded;
                    }
                    return b.totalNeeded - a.totalNeeded;
            }
        });
    }, [processedItems, searchQuery, showCompleted, sortOption, onlyActive, filterMode]);

    const toggleExpand = (itemId: string) => {
        setExpandedItemId(expandedItemId === itemId ? null : itemId);
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center sticky top-20 z-20 shadow-lg">
                <div className="relative w-full md:w-80">
                    <input
                        type="text"
                        placeholder="検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded px-4 py-2 pl-10 focus:outline-none focus:border-yellow-500 text-sm"
                    />
                    <svg
                        className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Sort Dropdown */}
                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value as SortOption)}
                        className="bg-gray-700 text-white border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                    >
                        <option value="default">おすすめ順</option>
                        <option value="count-desc">個数が多い順</option>
                        <option value="count-asc">個数が少ない順</option>
                        <option value="level-asc">要求Lvが低い順</option>
                    </select>

                    {/* Active Filter Toggle */}
                    <button
                        onClick={() => setOnlyActive(!onlyActive)}
                        className={`px-3 py-2 rounded border text-sm transition-colors flex items-center gap-2 ${onlyActive
                            ? 'bg-green-600/20 border-green-500 text-green-400'
                            : 'bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600'
                            }`}
                        title="現在受注可能なタスク（レベル到達済み）のアイテムのみ表示"
                    >
                        <span className={onlyActive ? 'opacity-100' : 'opacity-50'}>🔓</span>
                        <span>受注可のみ</span>
                    </button>

                    <div className="h-6 w-px bg-gray-600 mx-2 hidden md:block"></div>
                    <div className="text-sm text-gray-400 w-32 flex-shrink-0">
                        表示: <span className="font-bold text-white">{filteredItems.length}</span> / {processedItems.length}
                    </div>

                    {/* Filter Toggles */}
                    {filterMode !== 'collector-only' && filterMode !== 'hideout-only' && (
                        <div className="flex items-center gap-4">
                            {/* Kappa Mode Switch */}
                            <div className="flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg border border-gray-600">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <span className="text-sm font-bold text-orange-400">κ Mode</span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={kappaMode}
                                            onChange={(e) => setKappaMode(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                    </div>
                                </label>
                            </div>

                            {/* Lightkeeper Mode Switch */}
                            <div className="flex items-center gap-2 bg-gray-700/50 p-2 rounded-lg border border-gray-600">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <span className="text-sm font-bold text-cyan-400">LK Mode</span>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={lightkeeperMode}
                                            onChange={(e) => setLightkeeperMode(e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer select-none bg-gray-700 px-3 py-1.5 rounded border border-gray-600 hover:bg-gray-600 transition-colors">
                        <input
                            type="checkbox"
                            checked={showCompleted}
                            onChange={(e) => setShowCompleted(e.target.checked)}
                            className="w-4 h-4 text-yellow-500 rounded focus:ring-yellow-500 bg-gray-800 border-gray-500"
                        />
                        <span className="text-sm">完了済みも表示</span>
                    </label>
                </div>
            </div>

            {/* Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((status) => (
                    <div
                        key={status.item.id}
                        className={`bg-gray-800 rounded-lg border transition-all duration-200 overflow-hidden ${status.remainingNeeded === 0
                            ? 'border-green-800/50 opacity-60'
                            : 'border-gray-700 hover:border-yellow-500/50 hover:shadow-lg'
                            }`}
                    >
                        {/* Card Header */}
                        <div
                            className="p-3 flex items-center gap-3 cursor-pointer select-none"
                            onClick={() => toggleExpand(status.item.id)}
                        >
                            <div className="relative w-12 h-12 flex-shrink-0 bg-gray-700 rounded border border-gray-600 p-1">
                                {status.item.iconLink ? (
                                    <Image
                                        src={status.item.iconLink}
                                        alt={status.item.name}
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">No Img</div>
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-gray-200 truncate text-sm" title={status.item.name}>
                                    {status.item.name}
                                </div>
                                <div className="text-xs text-gray-400 truncate">
                                    {status.item.shortName}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className={`text-xl font-bold ${status.remainingNeeded > 0 ? 'text-yellow-400' : 'text-green-500'}`}>
                                    {status.remainingNeeded}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                    Total: {status.totalNeeded}
                                </div>
                            </div>
                        </div>

                        {/* Expandable Details */}
                        {expandedItemId === status.item.id && (
                            <div className="bg-gray-900/50 border-t border-gray-700 p-3 text-sm animate-fadeIn">
                                <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">必要なタスク</div>
                                <ul className="space-y-2">
                                    {status.relatedTasks.map((task, idx) => (
                                        <li key={`${task.taskId}-${idx}`} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {/* カウンターコントロール */}
                                                <div className={`flex items-center gap-1 flex-shrink-0 ${task.isCompleted ? 'opacity-50' : ''}`}>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!task.isCompleted) {
                                                                decrementFirItemCount(task.taskId, status.item.id);
                                                            }
                                                        }}
                                                        disabled={task.isCompleted || task.collectedCount === 0}
                                                        className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${task.isCompleted || task.collectedCount === 0
                                                                ? 'bg-gray-800 border-gray-600 text-gray-600 cursor-not-allowed'
                                                                : 'bg-gray-700 border-gray-500 hover:border-red-400 hover:bg-red-500/20 text-white'
                                                            }`}
                                                        title="個数を減らす"
                                                    >
                                                        <span className="text-xs font-bold">−</span>
                                                    </button>
                                                    <div className={`w-10 h-6 rounded border flex items-center justify-center text-xs font-bold ${task.collectedCount >= task.count
                                                            ? 'bg-green-500/20 border-green-500 text-green-400'
                                                            : task.collectedCount > 0
                                                                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                                                                : 'bg-gray-700 border-gray-600 text-gray-400'
                                                        }`}>
                                                        {task.isCompleted ? '✓' : task.collectedCount}
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!task.isCompleted) {
                                                                incrementFirItemCount(task.taskId, status.item.id, task.count);
                                                            }
                                                        }}
                                                        disabled={task.isCompleted || task.collectedCount >= task.count}
                                                        className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${task.isCompleted || task.collectedCount >= task.count
                                                                ? 'bg-gray-800 border-gray-600 text-gray-600 cursor-not-allowed'
                                                                : 'bg-gray-700 border-gray-500 hover:border-green-400 hover:bg-green-500/20 text-white'
                                                            }`}
                                                        title="個数を増やす"
                                                    >
                                                        <span className="text-xs font-bold">+</span>
                                                    </button>
                                                </div>
                                                <Link
                                                    href={`/traders/${traderNameToSlug(task.trader)}?taskId=${task.taskId}`}
                                                    className={`flex items-center gap-2 hover:underline truncate ${task.isCompleted
                                                            ? 'text-green-600 line-through decoration-green-600'
                                                            : task.collectedCount >= task.count
                                                                ? 'text-green-400 line-through decoration-green-500'
                                                                : 'text-gray-300 hover:text-yellow-400'
                                                        }`}
                                                >
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getTraderColor(task.trader)} text-gray-900 min-w-[3.5rem] text-center`}>
                                                        {task.trader}
                                                    </span>
                                                    <span className="truncate" title={task.taskName}>
                                                        {task.taskName}
                                                    </span>
                                                </Link>
                                            </div>
                                            <span className={`text-xs font-mono font-bold ml-2 ${task.isCompleted || task.collectedCount >= task.count ? 'text-green-600' : 'text-yellow-500'
                                                }`}>
                                                x{task.count}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                                {status.item.wikiLink && (
                                    <a
                                        href={status.item.wikiLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block mt-3 text-xs text-blue-400 hover:underline text-center border-t border-gray-700/50 pt-2"
                                    >
                                        Wikiを開く ↗
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {filteredItems.length === 0 && (
                    <div className="col-span-full py-12 text-center text-gray-500">
                        アイテムが見つかりませんでした。
                    </div>
                )}
            </div>
        </div>
    );
}

function getTraderColor(traderName: string): string {
    switch (traderName.toLowerCase()) {
        case 'prapor': return 'bg-yellow-200';
        case 'therapist': return 'bg-red-200';
        case 'fence': return 'bg-gray-400';
        case 'skier': return 'bg-blue-200';
        case 'peacekeeper': return 'bg-blue-400';
        case 'mechanic': return 'bg-orange-200';
        case 'ragman': return 'bg-green-200';
        case 'jaeger': return 'bg-green-400';
        default: return 'bg-gray-300';
    }
}
