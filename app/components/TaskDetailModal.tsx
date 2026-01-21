'use client';

import { Task } from '../types/task';

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
}: TaskDetailModalProps) {
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

        {/* 他トレーダーの前提 */}
        {crossTraderRequirements.length > 0 && (
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-orange-400 mb-2">他トレーダーの前提</h3>
            <div className="space-y-2">
              {crossTraderRequirements.map((reqTask, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-400 cursor-pointer p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
                  onClick={() => {
                    onNavigateToTrader(reqTask.trader.name, reqTask.id);
                    onClose();
                  }}
                >
                  <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-semibold">
                    {reqTask.trader.name}
                  </span>
                  <span className="font-semibold">{reqTask.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="flex flex-col gap-3 mt-6">
          <div className="flex gap-3">
            <button
              onClick={() => {
                onToggleComplete();
                onClose();
              }}
              disabled={isLocked}
              className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-colors ${
                isLocked
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : isCompleted
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isLocked 
                ? '🔒 前提タスクが未完了'
                : isCompleted 
                ? '✓ 完了済み（クリックで未完了に）' 
                : 'タスクを完了にする'}
            </button>
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
            >
              Wiki
            </button>
          </div>
          
          {/* 強制完了ボタン */}
          {isLocked && onForceComplete && (
            <button
              onClick={() => {
                if (window.confirm(
                  `このタスクとすべての前提タスクを完了済みにしますか？\n\n「${task.name}」を含む、すべての依存タスクが完了済みとしてマークされます。\n\nこの操作は、アプリを初めて使用する際に便利ですが、実際のゲーム進行状況とは異なる場合があります。`
                )) {
                  onForceComplete();
                  onClose();
                }
              }}
              className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors"
            >
              🔓 依存タスクを含めて強制完了にする
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
