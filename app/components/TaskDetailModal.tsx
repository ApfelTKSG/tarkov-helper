'use client';

import { Task } from '../types/task';
import { TaskFirItem, FirItemDetail } from '../types/firItem';
import Image from 'next/image';

interface TaskDetailModalProps {
  task: Task;
  allTasks: Task[];
  isOpen: boolean;
  onClose: () => void;
  onToggleComplete: () => void;
  onForceComplete?: () => void;
  isCompleted: boolean;
  isLocked: boolean;
  onNavigateToTrader: (traderName: string, taskId: string) => void;
  firItems?: TaskFirItem[];
  itemDetailsMap?: Map<string, FirItemDetail>;
  collectedFirItems: Set<string>;
  onToggleFirItem: (itemId: string) => void;
  completedTasks: Set<string>;
  showFirOnly?: boolean;
}

export default function TaskDetailModal({
  task,
  allTasks,
  isOpen,
  onClose,
  onToggleComplete,
  onForceComplete,
  isCompleted,
  isLocked,
  onNavigateToTrader,
  firItems,
  itemDetailsMap,
  collectedFirItems,
  onToggleFirItem,
  completedTasks,
  showFirOnly = false,
}: TaskDetailModalProps) {
  // 内部状態（useState/useEffect）を削除し、Propsから受け取ったデータを使用する

  if (!isOpen) return null;

  // タスクIDからタスク情報を取得
  const taskMap = new Map(allTasks.map(t => [t.id, t]));

  // 他トレーダーの前提タスク
  const crossTraderRequirements = task.taskRequirements
    .map(req => taskMap.get(req.task.id))
    .filter((t): t is Task => t !== undefined && t.trader.name !== task.trader.name);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                {task.trader.name}
              </span>
              {task.isCollectorRequirement && (
                <span className="text-orange-500 font-bold text-lg" title="Collectorタスクの前提">
                  κ
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">{task.name}</h2>
            <div className="text-sm text-gray-400">
              {task.experience > 0 && `${task.experience.toLocaleString()} XP`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold ml-4"
          >
            ×
          </button>
        </div>

        {/* タスクの説明 */}
        {task.objectives && task.objectives.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white mb-2">目標</h3>
            <ul className="space-y-1">
              {task.objectives.map((obj, idx) => (
                <li key={idx} className="text-sm text-gray-300">
                  • {obj.description || obj.type}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* FiRアイテムチェックリスト */}
        {firItems && firItems.length > 0 && (() => {
          const filteredItems = task.type === 'hideout' && showFirOnly
            ? firItems.filter(item => item.isFirRequired)
            : firItems;

          return filteredItems.length > 0 ? (
            <div className="mb-6 bg-gray-750 p-4 rounded-lg border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <span className="text-blue-400 text-xl">📦</span>
                {task.type === 'hideout' ? '必要なアイテム' : '必要なFound in Raidアイテム'}
              </h3>
              <div className="space-y-2">
                {filteredItems.map((item, idx) => {
                  const details = itemDetailsMap?.get(item.itemId);
                  const isItemCollected = collectedFirItems.has(`${task.id}-${item.itemId}`);
                  const showAsCollected = isItemCollected || isCompleted;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2 rounded-lg border transition-colors select-none ${showAsCollected
                        ? 'bg-green-900/30 border-green-700/50'
                        : 'bg-gray-700 border-gray-600 hover:bg-gray-650'
                        } ${!isCompleted ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
                      onClick={() => {
                        if (!isCompleted) {
                          onToggleFirItem(item.itemId);
                        }
                      }}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showAsCollected ? 'bg-green-500 border-green-500' : 'bg-gray-800 border-gray-500'
                        }`}>
                        {showAsCollected && <span className="text-white text-xs font-bold">✓</span>}
                      </div>

                      {details?.iconLink && (
                        <div className="relative w-10 h-10 bg-gray-900 rounded border border-gray-600 flex-shrink-0">
                          <Image
                            src={details.iconLink}
                            alt={item.itemName}
                            fill
                            className="object-contain p-1"
                            unoptimized
                          />
                        </div>
                      )}

                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <span className={`font-semibold ${showAsCollected ? 'text-gray-400 line-through' : 'text-gray-200'}`}>
                            {item.itemName}
                          </span>
                          <span className="text-sm font-bg bg-gray-800 px-2 py-0.5 rounded text-blue-300">
                            x{item.count}
                          </span>
                        </div>
                        {task.type === 'hideout' && item.isFirRequired && (
                          <span className="text-xs font-bold text-yellow-500 bg-yellow-900/30 border border-yellow-700/50 px-1.5 py-0.5 rounded mt-1 inline-block mr-1">
                            ✔ FiR
                          </span>
                        )}
                        {item.optional && (
                          <span className="text-xs text-yellow-500 block">オプショナル</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-400 mt-2 text-right">
                {isCompleted ? 'タスク完了済みのため、アイテムも納品済みとして扱われます' : 'クリックして納品済みをマーク'}
              </p>
            </div>
          ) : null;
        })()}

        {/* 他トレーダーの前提 */}
        {crossTraderRequirements.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-2">他トレーダーの前提</h3>
            <div className="space-y-2">
              {crossTraderRequirements.map((reqTask, idx) => {
                const isReqCompleted = completedTasks.has(reqTask.id);
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm cursor-pointer p-2 rounded transition-colors ${isReqCompleted
                      ? 'bg-gray-800/50 text-gray-400 opacity-70'
                      : 'bg-gray-700 text-orange-400 hover:bg-gray-600 hover:text-orange-300'
                      }`}
                    onClick={() => {
                      onNavigateToTrader(reqTask.trader.name, reqTask.id);
                      onClose();
                    }}
                  >
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${isReqCompleted ? 'bg-gray-600 text-gray-300' : 'bg-orange-600 text-white'}`}>
                      {reqTask.trader.name}
                    </span>
                    <span className={`font-semibold ${isReqCompleted ? 'line-through' : ''}`}>{reqTask.name}</span>
                    {isReqCompleted && <span className="ml-auto text-green-500 font-bold">✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col gap-3 mt-6">
          <div className="flex gap-3">
            {isLocked ? (
              // Locked: Show Force Complete Button
              <button
                onClick={() => {
                  if (onForceComplete && window.confirm(
                    `このタスクとすべての前提タスクを完了済みにしますか？\n\n「${task.name}」を含む、すべての依存タスクが完了済みとしてマークされます。`
                  )) {
                    onForceComplete && onForceComplete();
                    onClose();
                  }
                }}
                className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-xl">🔓</span>
                <span>依存タスクを含めて強制完了にする</span>
              </button>
            ) : (
              // Unlocked: Show Standard Complete Button
              <button
                onClick={() => {
                  onToggleComplete();
                  onClose();
                }}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${isCompleted
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {isCompleted
                  ? '✓ 完了済み（クリックで未完了に）'
                  : 'タスクを完了にする'}
              </button>
            )}

            <button
              onClick={() => {
                const cleanedName = task.name
                  .replace(/\s*\[PVP ZONE\]$/i, '')
                  .trim()
                  .replace(/ /g, '_');
                const wikiUrl = `https://escapefromtarkov.fandom.com/wiki/${cleanedName}`;
                window.open(wikiUrl, '_blank');
              }}
              className="py-3 px-6 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
              title="Wikiを開く"
            >
              Wiki
            </button>
          </div>
        </div>
      </div>
    </div >
  );
}
