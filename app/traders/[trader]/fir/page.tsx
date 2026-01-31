import Link from 'next/link';
import TaskTreeView from '@/app/components/TaskTreeView';
import ProgressStats from '@/app/components/ProgressStats';
import TraderTaskSync from '@/app/components/TraderTaskSync';
import { getTaskData, getUniqueTraderNames } from '@/app/lib/taskData';
import { getFirItemsData } from '@/app/lib/firItemData';

interface PageProps {
    params: Promise<{
        trader: string;
    }>;
}

export async function generateStaticParams() {
    const taskData = getTaskData();
    const traders = getUniqueTraderNames(taskData);

    // 各トレーダーのパラメータを返す
    return traders.map(traderName => ({
        trader: encodeURIComponent(traderName),
    }));
}

export default async function TraderFirPage({ params }: PageProps) {
    const { trader: encodedTrader } = await params;
    const traderName = decodeURIComponent(encodedTrader);

    // データ読み込み
    const taskData = getTaskData();
    const firData = getFirItemsData();

    // FiRが必要なタスクIDのセット作成
    const firRequiredTaskIds = new Set(
        firData.itemsByTask
            .filter(t => t.trader === traderName && t.firItems.length > 0) // 現在のトレーダーかつFiRアイテムがあるもの
            .map(t => t.taskId)
    );

    // タスクをユニーク化
    const uniqueTasks = Array.from(
        taskData.tasks.reduce((map, task) => {
            const key = `${task.trader.name}::${task.name}`;
            if (!map.has(key)) {
                map.set(key, task);
            }
            return map;
        }, new Map()).values()
    );

    // 指定されたトレーダーのタスクの中で、FiRが必要なものだけを抽出
    // ※ ただし、ツリー構造（依存関係）を完全に維持するには中間ノードも必要だが、
    // ユーザーの要望は「FiRタスクだけを見たい」なので、ここでは単純にフィルタリングする。
    // 必要であれば、親タスクを辿って間を埋めるロジックを追加するが、まずはシンプルに。
    const traderFirTasks = uniqueTasks.filter(task =>
        task.trader.name === traderName && firRequiredTaskIds.has(task.id)
    );

    if (uniqueTasks.filter(t => t.trader.name === traderName).length === 0) {
        return (
            <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-white mb-4">トレーダーが見つかりません</h1>
                    <Link href="/" className="text-yellow-400 hover:underline">
                        トップページに戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex justify-between items-center mb-3">
                        <Link
                            href={`/traders/${encodedTrader}`}
                            className="text-yellow-400 hover:text-yellow-300 text-sm inline-block"
                        >
                            ← 全タスク表示に戻る
                        </Link>
                    </div>

                    <div className="flex items-center gap-4 mb-3">
                        <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                        <h1 className="text-4xl font-bold text-white">{traderName} (FiR Only)</h1>
                        <div className="flex-1 ml-8">
                            <ProgressStats tasks={traderFirTasks} traderName={traderName} />
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4" style={{ paddingTop: '2rem', paddingBottom: '2rem', height: 'calc(100vh - var(--header-height, 140px))' }}>
                {traderFirTasks.length > 0 ? (
                    <>
                        <TraderTaskSync traderName={traderName} taskIds={traderFirTasks.map(t => t.id)} />
                        <div style={{ height: 'calc(100% - 2rem)' }}>
                            <TaskTreeView
                                tasks={traderFirTasks}
                                allTasks={uniqueTasks}
                                traderName={traderName}
                                firItemsData={firData}
                                initialShowFirItems={true}
                            />
                        </div>
                    </>
                ) : (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-xl">このトレーダーにはFiRアイテムが必要なタスクはありません。</p>
                        <Link
                            href={`/traders/${encodedTrader}`}
                            className="text-blue-400 hover:underline mt-4 inline-block"
                        >
                            通常のタスクツリーを見る
                        </Link>
                    </div>
                )}
            </main>
        </div>
    );
}
