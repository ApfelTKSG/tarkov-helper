'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { FirItemDetail } from '@/app/types/firItem';

interface FirItemsListProps {
  items: FirItemDetail[];
}

type SortOption = 'name' | 'taskCount' | 'totalNeeded' | 'price';

export default function FirItemsList({ items }: FirItemsListProps) {
  const [sortBy, setSortBy] = useState<SortOption>('taskCount');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTrader, setSelectedTrader] = useState<string>('all');

  // トレーダーリストを取得
  const traders = useMemo(() => {
    const traderSet = new Set<string>();
    items.forEach(item => {
      item.requiredByTasks.forEach(task => traderSet.add(task.trader));
    });
    return Array.from(traderSet).sort();
  }, [items]);

  // フィルタリング&ソート
  const filteredAndSortedItems = useMemo(() => {
    let filtered = items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.shortName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTrader = selectedTrader === 'all' ||
                          item.requiredByTasks.some(task => task.trader === selectedTrader);
      
      return matchesSearch && matchesTrader;
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'taskCount':
          return b.requiredByTasks.length - a.requiredByTasks.length;
        case 'totalNeeded':
          const totalA = a.requiredByTasks.reduce((sum, t) => sum + t.count, 0);
          const totalB = b.requiredByTasks.reduce((sum, t) => sum + t.count, 0);
          return totalB - totalA;
        case 'price':
          return b.avg24hPrice - a.avg24hPrice;
        default:
          return 0;
      }
    });
  }, [items, searchQuery, selectedTrader, sortBy]);

  return (
    <div className="space-y-4">
      {/* フィルター&ソートコントロール */}
      <div className="bg-gray-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          {/* 検索 */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              アイテム検索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="アイテム名で検索..."
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* トレーダーフィルター */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              トレーダー
            </label>
            <select
              value={selectedTrader}
              onChange={(e) => setSelectedTrader(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">すべて</option>
              {traders.map(trader => (
                <option key={trader} value={trader}>{trader}</option>
              ))}
            </select>
          </div>

          {/* ソート */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              ソート
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="taskCount">タスク数が多い順</option>
              <option value="totalNeeded">合計必要数が多い順</option>
              <option value="price">価格が高い順</option>
              <option value="name">名前順</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-gray-400">
          {filteredAndSortedItems.length} 件のアイテム
        </div>
      </div>

      {/* アイテムリスト */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedItems.map((item) => {
          const totalNeeded = item.requiredByTasks.reduce((sum, t) => sum + t.count, 0);
          
          return (
            <div
              key={item.id}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* アイテムアイコン */}
                {item.iconLink && (
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-900 rounded border border-gray-700 flex items-center justify-center">
                    <Image
                      src={item.iconLink}
                      alt={item.name}
                      width={64}
                      height={64}
                      className="object-contain"
                    />
                  </div>
                )}

                {/* アイテム情報 */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm mb-1 truncate">
                    {item.name}
                  </h3>
                  <p className="text-xs text-gray-400 mb-2">{item.shortName}</p>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">必要タスク:</span>
                      <span className="text-white font-medium">
                        {item.requiredByTasks.length}件
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">合計必要数:</span>
                      <span className="text-white font-medium">{totalNeeded}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">平均価格:</span>
                      <span className="text-yellow-400 font-medium">
                        ₽{item.avg24hPrice.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">サイズ:</span>
                      <span className="text-white">
                        {item.width}x{item.height} ({item.weight}kg)
                      </span>
                    </div>
                  </div>

                  {/* 必要とするタスク（最初の3つ） */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">必要とするタスク:</p>
                    <div className="space-y-1">
                      {item.requiredByTasks.slice(0, 3).map((task) => (
                        <div key={task.taskId} className="text-xs">
                          <span className="text-gray-300">{task.taskName}</span>
                          <span className="text-gray-500"> ({task.trader})</span>
                          <span className="text-blue-400 ml-1">x{task.count}</span>
                        </div>
                      ))}
                      {item.requiredByTasks.length > 3 && (
                        <p className="text-xs text-gray-500">
                          他 {item.requiredByTasks.length - 3} タスク...
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedItems.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          該当するアイテムが見つかりませんでした
        </div>
      )}
    </div>
  );
}
