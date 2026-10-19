'use client';

import Link from 'next/link';
import { useGame } from '@/app/context/GameContext';
import PlayerLevelInput from './PlayerLevelInput';
import TraderNavigation from './TraderNavigation';

export type WorkspaceSection =
  'tasks' | 'items' | 'collector' | 'hideout' | 'hideout-fir' | 'raid' | 'maps' | 'settings';
const tabControl = 'ui-nav-link';
const links = [
  { section: 'tasks', href: '/', label: 'タスク' },
  { section: 'maps', href: '/maps', label: 'マップ別' },
  { section: 'items', href: '/fir', label: 'FiR' },
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
    <header className="relative shrink-0 border-b border-slate-700 bg-slate-900">
      <div className="space-y-2 px-3 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/" className="text-base font-semibold tracking-tight">
              Tarkov Helper
            </Link>
            <PlayerLevelInput key={profile.id} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="ページ" className="flex flex-wrap gap-0.5 text-sm">
              {links.map((link) => (
                <Link
                  key={link.section}
                  href={link.href}
                  className={tabControl}
                  aria-current={
                    section === link.section ||
                    (link.section === 'items' && section === 'collector')
                      ? 'page'
                      : undefined
                  }
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
            <Link
              href="/settings"
              className={tabControl}
              aria-current={section === 'settings' ? 'page' : undefined}
            >
              設定
            </Link>
          </div>
        </div>
        <TraderNavigation trader={trader} allSelected={!trader && section === 'tasks'} />
      </div>
    </header>
  );
}
