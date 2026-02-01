'use strict';
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { FirItemsData, FirItemDetail } from '@/app/types/firItem';
import { traderNameToSlug } from '@/app/lib/traderSlug';
import Link from 'next/link';
import { useFilterMode } from '@/app/context/FilterModeContext';

interface FirManagerProps {
    firData: FirItemsData;
    filterMode?: 'all' | 'exclude-collector' | 'collector-only';
}

interface ItemStatus {
    item: FirItemDetail;
    totalNeeded: number;
    remainingNeeded: number;
    relatedTasks: Array<{
        taskId: string;
        taskName: string;
        trader: string;
        count: number;
        isCompleted: boolean;
    }>;
}

export default function FirManager({ firData, filterMode = 'all' }: FirManagerProps) {
    const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [showCompleted, setShowCompleted] = useState(false);
    // Global Filter State
    const { kappaMode, setKappaMode, lightkeeperMode, setLightkeeperMode } = useFilterMode();
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

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
    }, []);

    // Process items data based on completed tasks
    const processedItems: ItemStatus[] = useMemo(() => {
        return firData.itemsIndex.map((item) => {
            const relatedTasks = item.requiredByTasks.map((req) => ({
                taskId: req.taskId,
                taskName: req.taskName,
                trader: req.trader,
                count: req.count,
                isCompleted: completedTasks.has(req.taskId),
                isCollectorRequirement: req.isCollectorRequirement,
                isLightkeeperRequirement: req.isLightkeeperRequirement,
            })).filter(task => {
                // 基本フィルター（除外ロジック）
                if (filterMode === 'exclude-collector' && task.taskName === 'Collector') return false;
                if (filterMode === 'collector-only' && task.taskName !== 'Collector') return false;

                // モードフィルター（包含ロジック）
                // どちらかのモードがオンの場合、そのモードの条件を満たすタスクのみを表示する
                const isModeActive = kappaMode || lightkeeperMode;
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
                (sum, task) => (task.isCompleted ? sum : sum + task.count),
                0
            );

            return {
                item,
                totalNeeded,
                remainingNeeded,
                relatedTasks,
            };
        })
            .filter(status => status.totalNeeded > 0) // フィルタリングの結果、必要数が0になったアイテムは除外
            .sort((a, b) => {
                // Sort by remaining needed (desc), then by total needed (desc)
                if (a.remainingNeeded !== b.remainingNeeded) {
                    return b.remainingNeeded - a.remainingNeeded;
                }
                return b.totalNeeded - a.totalNeeded;
            });
    }, [firData.itemsIndex, completedTasks, filterMode, kappaMode, lightkeeperMode]);

    // Filter items
    const filteredItems = useMemo(() => {
        return processedItems.filter((status) => {
            // Search filter
            const matchesSearch =
                searchQuery === '' ||
                status.item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                status.item.shortName.toLowerCase().includes(searchQuery.toLowerCase());

            // Completion filter
            const matchesCompletion = showCompleted || status.remainingNeeded > 0;

            return matchesSearch && matchesCompletion;
        });
    }, [processedItems, searchQuery, showCompleted]);

    const toggleExpand = (itemId: string) => {
        setExpandedItemId(expandedItemId === itemId ? null : itemId);
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row gap-4 justify-between items-center sticky top-20 z-20 shadow-lg">
                <div className="relative w-full md:w-96">
                    <input
                        type="text"
                        placeholder="アイテム名または略称で検索..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded px-4 py-2 pl-10 focus:outline-none focus:border-yellow-500"
                    />
                    <svg
                        className="w-5 h-5 text-gray-400 absolute left-3 top-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="text-sm text-gray-400 w-32 flex-shrink-0">
                        表示: <span className="font-bold text-white">{filteredItems.length}</span> / {processedItems.length}
                    </div>

                    {/* Filter Toggles */}
                    {filterMode !== 'collector-only' && (
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
                                            <Link
                                                href={`/traders/${traderNameToSlug(task.trader)}?taskId=${task.taskId}`}
                                                className={`flex items-center gap-2 hover:underline ${task.isCompleted ? 'text-green-600 line-through decoration-green-600' : 'text-gray-300 hover:text-yellow-400'}`}
                                            >
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getTraderColor(task.trader)} text-gray-900 min-w-[3.5rem] text-center`}>
                                                    {task.trader}
                                                </span>
                                                <span className="truncate max-w-[120px] sm:max-w-[200px]" title={task.taskName}>
                                                    {task.taskName}
                                                </span>
                                            </Link>
                                            <span className={`text-xs font-mono font-bold ${task.isCompleted ? 'text-green-600' : 'text-yellow-500'}`}>
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
