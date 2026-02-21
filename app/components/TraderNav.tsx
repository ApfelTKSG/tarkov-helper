import Link from 'next/link';
import Image from 'next/image';
import { traderNameToSlug } from '../lib/traderSlug';

export const TRADER_IMAGES: Record<string, string> = {
    Prapor: 'https://assets.tarkov.dev/54cb50c76803fa8b248b4571.webp',
    Therapist: 'https://assets.tarkov.dev/54cb57776803fa99248b456e.webp',
    Fence: 'https://assets.tarkov.dev/579dc571d53a0658a154fbec.webp',
    Skier: 'https://assets.tarkov.dev/58330581ace78e27b8b10cee.webp',
    Peacekeeper: 'https://assets.tarkov.dev/5935c25fb3acc3127c3d8cd9.webp',
    Mechanic: 'https://assets.tarkov.dev/5a7c2eca46aef81a7ca2145d.webp',
    Ragman: 'https://assets.tarkov.dev/5ac3b934156ae10c4430e83c.webp',
    Jaeger: 'https://assets.tarkov.dev/5c0647fdd443bc2504c2d371.webp',
    Lightkeeper: 'https://assets.tarkov.dev/638f541a29ffd1183d187f57.webp',
    Ref: 'https://assets.tarkov.dev/6617beeaa9cfa777ca915b7c.webp',
    'BTR Driver': 'https://assets.tarkov.dev/656f0f98d80a697f855d34b1.webp',
    BTR: 'https://assets.tarkov.dev/656f0f98d80a697f855d34b1.webp'
};

export default function TraderNav({ currentTrader, traders }: { currentTrader: string, traders: string[] }) {
    // Hideoutを一番右に持ってきたい場合や特定の順序にする場合はここでソートする
    // 今回はtradersをそのまま使う
    return (
        <div className="flex flex-wrap items-center gap-2 mb-4">
            <Link
                href="/"
                className="flex items-center justify-center w-12 h-12 bg-gray-800 border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
                title="ホームへ戻る"
            >
                <span className="text-xl">🏠</span>
            </Link>

            {traders.map(t => (
                <Link
                    key={t}
                    href={`/traders/${traderNameToSlug(t)}`}
                    className={`flex items-center justify-center w-12 h-12 rounded-lg border transition-colors ${t === currentTrader ? 'bg-yellow-500/20 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                    title={t}
                >
                    {TRADER_IMAGES[t] ? (
                        <div className="w-10 h-10 relative rounded overflow-hidden shadow-inner">
                            <Image src={TRADER_IMAGES[t]} alt={t} fill className="object-cover" unoptimized />
                        </div>
                    ) : (
                        t === 'Hideout' ? <span className="text-2xl">🛠️</span> : <span className="text-2xl">👑</span>
                    )}
                </Link>
            ))}

            <Link
                href="/traders/Hideout"
                className={`flex items-center justify-center w-12 h-12 rounded-lg border transition-colors ${currentTrader === 'Hideout' ? 'bg-purple-900/40 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
                title="Hideout"
            >
                <span className="text-2xl">🛠️</span>
            </Link>

            <div className="flex-1"></div>

            <Link
                href={`/fir`}
                className={`flex items-center gap-2 px-4 h-12 rounded-lg border bg-blue-900/40 border-blue-700 text-blue-300 hover:bg-blue-800 transition-colors`}
            >
                <span className="text-xl">📦</span>
                <span className="text-sm font-bold hidden sm:inline">FiR管理</span>
            </Link>
        </div>
    );
}
