'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import PlayerLevelInput from './PlayerLevelInput';
import ProfileControls from './ProfileControls';
import TraderNavigation from './TraderNavigation';

export type WorkspaceSection =
  'tasks' | 'items' | 'collector' | 'hideout' | 'hideout-fir' | 'raid' | 'maps';
const tabControl =
  'rounded border border-slate-600 bg-slate-800 px-2.5 py-1.5 text-xs font-medium sm:text-sm';
const links = [
  { section: 'tasks', href: '/', label: 'タスク' },
  { section: 'maps', href: '/maps', label: 'マップ別' },
  { section: 'items', href: '/fir', label: 'FiR' },
  { section: 'collector', href: '/fir/collector', label: 'Collector' },
] as const;

/** Every workspace page shares this header; page layout never selects a different version. */
export default function WorkspaceHeader({
  trader,
  section,
}: {
  trader?: string;
  section: WorkspaceSection;
}) {
  const { profile } = useGame();
  return (
    <header className="shrink-0 border-b border-slate-700 bg-slate-950">
      <div className="space-y-2 px-3 py-2 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="text-lg font-bold tracking-wide">
              Tarkov Helper
            </Link>
            <PlayerLevelInput key={profile.id} />
          </div>
          <nav aria-label="ページ" className="flex flex-wrap gap-2 text-sm">
            {links.map((link) => (
              <Link
                key={link.section}
                href={link.href}
                className={tabControl}
                aria-current={section === link.section ? 'page' : undefined}
              >
                {link.label}
              </Link>
            ))}
            <button
              type="button"
              disabled
              className={`${tabControl} cursor-not-allowed text-slate-500 opacity-50`}
              title="今シーズンは利用できません"
            >
              ハイドアウト
            </button>
            <Link
              className={tabControl}
              href="/raid"
              aria-current={section === 'raid' ? 'page' : undefined}
            >
              レイド準備
            </Link>
          </nav>
        </div>
        <details className="relative text-xs text-slate-400">
          <summary className="w-fit cursor-pointer">プロフィール・設定</summary>
          <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60dvh] overflow-y-auto rounded-xl border border-slate-600 bg-slate-950 p-3 shadow-2xl">
            <ProfileControls hidePlayerLevel />
          </div>
        </details>
        <TraderNavigation trader={trader} allSelected={!trader && section === 'tasks'} />
      </div>
    </header>
  );
}
