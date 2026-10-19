'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import Toast from './Toast';
import ApiImage from './ApiImage';
import { playerLevelBadge } from '@/src/domain/player-level';

export default function PlayerLevelInput() {
  const { profile, snapshot, edit, ready, storageError } = useGame();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (ready && !storageError && profile.level === undefined)
      edit((p) => (p.level === undefined ? { ...p, level: 1 } : p));
  }, [ready, storageError, profile.level, edit]);
  const changed = useRef(false);
  const [saved, setSaved] = useState(0);
  const close = useCallback(() => setSaved(0), []);
  return (
    <>
      <label className="flex items-center gap-2 whitespace-nowrap px-1 py-1 text-xs text-slate-400">
        {profile.faction && (
          <ApiImage
            src={`${process.env.NODE_ENV === 'production' ? '/tarkov-helper' : ''}/images/factions/${profile.faction}.webp`}
            name={profile.faction}
            className="h-7 w-7 object-contain brightness-0 invert"
          />
        )}
        <ApiImage
          src={playerLevelBadge(profile.level ?? 1, snapshot)}
          name={`レベル ${profile.level ?? 1} の階級`}
          className="h-7 w-7 object-contain"
        />
        <span>PMCレベル</span>
        <input
          aria-label="PMCレベル"
          type="number"
          min="1"
          step="1"
          value={editing ? draft : (profile.level ?? 1)}
          disabled={!ready || !!storageError}
          className="w-14 rounded border border-slate-700 bg-slate-800 px-1 py-1 text-center text-base font-semibold text-slate-100 disabled:opacity-40"
          onFocus={() => {
            setDraft(String(profile.level ?? 1));
            setEditing(true);
          }}
          onChange={(event) => {
            setDraft(event.target.value);
            const level = Number(event.target.value);
            if (Number.isInteger(level) && level >= 1 && edit((p) => ({ ...p, level })))
              changed.current = true;
          }}
          onBlur={() => {
            setEditing(false);
            if (changed.current) {
              setSaved((value) => value + 1);
              changed.current = false;
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
      </label>
      {saved > 0 && <Toast key={saved} message="PMCレベルを保存しました" onClose={close} />}
    </>
  );
}
