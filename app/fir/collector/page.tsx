
import Link from 'next/link';
import { getFirItemsData } from '@/app/lib/firItemData';
import FirManager from '../components/FirManager';

export default function CollectorPage() {
    const firData = getFirItemsData();

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100">
            <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-30">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <span className="text-xl">🏠</span>
                        </Link>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="text-orange-500">κ</span>
                            Collector管理
                        </h1>

                        {/* リンク追加 */}
                        <div className="ml-4 flex rounded-md bg-gray-700 p-1">
                            <Link
                                href="/fir"
                                className="px-3 py-1 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                通常タスク
                            </Link>
                            <span className="px-3 py-1 bg-gray-600 rounded text-sm text-white font-bold cursor-default shadow">
                                Collector専用
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-4 py-8">
                {/* collector-only モードで呼び出し */}
                <FirManager firData={firData} filterMode="collector-only" />
            </main>
        </div>
    );
}
