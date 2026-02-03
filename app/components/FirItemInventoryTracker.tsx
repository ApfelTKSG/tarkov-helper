'use client';

import { useState, useEffect } from 'react';
import { UserFirItemInventory } from '@/app/types/firItem';

interface FirItemInventoryTrackerProps {
  itemId: string;
  itemName: string;
  itemShortName: string;
  iconLink?: string;
  avg24hPrice: number;
  neededCount: number;
}

export default function FirItemInventoryTracker({
  itemId,
  itemName,
  itemShortName,
  iconLink,
  avg24hPrice,
  neededCount,
}: FirItemInventoryTrackerProps) {
  const [ownedCount, setOwnedCount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // localStorageから読み込み
  useEffect(() => {
    const stored = localStorage.getItem(`fir-item-${itemId}`);
    if (stored) {
      try {
        const data: UserFirItemInventory = JSON.parse(stored);
        setOwnedCount(data.ownedCount);
        setNotes(data.notes || '');
      } catch (e) {
        console.error('Failed to parse stored data', e);
      }
    }
  }, [itemId]);

  // 保存
  const saveInventory = (newCount: number, newNotes: string) => {
    const data: UserFirItemInventory = {
      itemId,
      itemName,
      itemShortName,
      ownedCount: newCount,
      neededCount,
      iconLink,
      avg24hPrice,
      notes: newNotes,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(`fir-item-${itemId}`, JSON.stringify(data));
  };

  const handleCountChange = (delta: number) => {
    const newCount = Math.max(0, ownedCount + delta);
    setOwnedCount(newCount);
    saveInventory(newCount, notes);
  };

  const handleNotesBlur = () => {
    saveInventory(ownedCount, notes);
    setIsEditing(false);
  };

  const progress = neededCount > 0 ? (ownedCount / neededCount) * 100 : 0;
  const isComplete = ownedCount >= neededCount;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border-2 border-gray-700 hover:border-gray-600 transition-colors">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">{itemShortName}</span>
          {isComplete && (
            <span className="text-xs bg-green-600 text-white px-2 py-1 rounded">
              完了
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400">
          {ownedCount} / {neededCount}
        </div>
      </div>

      {/* プログレスバー */}
      <div className="mb-3">
        <div className="w-full bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              isComplete ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* カウンター */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <button
          onClick={() => handleCountChange(-1)}
          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          disabled={ownedCount === 0}
        >
          -
        </button>
        <div className="flex-1 text-center">
          <div className="text-2xl font-bold text-white">{ownedCount}</div>
          <div className="text-xs text-gray-400">所持数</div>
        </div>
        <button
          onClick={() => handleCountChange(1)}
          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
        >
          +
        </button>
      </div>

      {/* メモ */}
      <div>
        {isEditing ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleNotesBlur}
            placeholder="メモ（保管場所など）..."
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            autoFocus
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer px-2 py-1 bg-gray-700 rounded text-sm text-gray-400 hover:bg-gray-650 transition-colors min-h-[2rem]"
          >
            {notes || 'メモを追加...'}
          </div>
        )}
      </div>

      {/* 価格情報 */}
      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
        推定価格: <span className="text-yellow-400">₽{avg24hPrice.toLocaleString()}</span>
        {' '}× {neededCount} ={' '}
        <span className="text-yellow-400 font-semibold">
          ₽{(avg24hPrice * neededCount).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
