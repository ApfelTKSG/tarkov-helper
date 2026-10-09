'use client';

import { newBeginningStage } from '@/src/domain/prestige';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { GameManifest, GameMode, GameSnapshot } from '@/src/domain/game';
import {
  resolveLegacyCounts,
  selectMode,
  type Profile,
  type ProfileDatabase,
} from '@/src/domain/profiles';
import { parseManifest, verifySnapshot } from '@/src/domain/snapshot';
import { evaluateAvailability } from '@/src/domain/progression';
import { effectiveTraderProgress } from '@/src/domain/traders';
import {
  getSnapshot,
  getServerSnapshot,
  initializeStore,
  subscribe,
  updateDatabase,
} from '@/src/client/profile-store';

interface GameContextValue {
  database: ProfileDatabase;
  profile: Profile;
  snapshot: GameSnapshot | null;
  manifest: GameManifest | null;
  ready: boolean;
  loading: boolean;
  error: string;
  storageError: string;
  notices: string[];
  edit: (update: (profile: Profile) => Profile) => boolean;
  changeMode: (mode: GameMode) => void;
  chooseProfile: (id: string) => void;
  refresh: () => void;
  availability: (task: GameSnapshot['tasks'][number]) => ReturnType<typeof evaluateAvailability>;
}
const GameContext = createContext<GameContextValue | null>(null);
const cache = new Map<string, GameSnapshot>();
const basePath = process.env.NODE_ENV === 'production' ? '/tarkov-helper' : '';
async function getJson(path: string, signal: AbortSignal) {
  const response = await fetch(`${basePath}/game-data/${path}`, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`ゲームデータを取得できません (${response.status})`);
  return response.json();
}

export function GameProvider({ children }: { children: ReactNode }) {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const profile = store.database.profiles[store.database.selectedId];
  const [data, setData] = useState<{
    snapshot: GameSnapshot | null;
    manifest: GameManifest | null;
    error: string;
    profileId: string;
  }>({ snapshot: null, manifest: null, error: '', profileId: '' });
  const [check, setCheck] = useState(0);
  useEffect(initializeStore, []);
  const { id, mode, seasonId, pinnedRevision, dataRevision } = profile;
  useEffect(() => {
    if (!store.ready) return;
    const controller = new AbortController();
    (async () => {
      try {
        const manifest = parseManifest(await getJson('manifest.json', controller.signal));
        if (controller.signal.aborted) return;
        setData((previous) => ({ ...previous, manifest, error: '' }));
        const entry = manifest.modes[mode];
        const archivedSeason = mode === 'pvp-season' && seasonId !== entry.seasonId;
        const revision = pinnedRevision ?? (archivedSeason ? dataRevision : entry.revision);
        if (!revision)
          throw new Error(
            'このシーズンのデータがありません。モードから現在のシーズンを選んでください',
          );
        const snapshot =
          cache.get(revision) ??
          (await verifySnapshot(
            await getJson(`${mode}/${revision}.json`, controller.signal),
            mode,
            revision,
            seasonId,
          ));
        if (controller.signal.aborted) return;
        cache.set(revision, snapshot);
        setData({ snapshot, manifest, error: '', profileId: id });
        updateDatabase((database) => {
          const current = database.profiles[id];
          const migrated = resolveLegacyCounts(current, snapshot);
          return {
            ...database,
            profiles: { ...database.profiles, [id]: { ...migrated, dataRevision: revision } },
          };
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setData((previous) => ({
          ...previous,
          error: error instanceof Error ? error.message : 'データ取得に失敗しました',
        }));
      }
    })();
    return () => controller.abort();
  }, [store.ready, id, mode, seasonId, pinnedRevision, dataRevision, check]);
  const edit = useCallback(
    (update: (profile: Profile) => Profile) =>
      updateDatabase((database) => ({
        ...database,
        profiles: { ...database.profiles, [id]: update(database.profiles[id]) },
      })),
    [id],
  );
  const snapshot = data.profileId === id ? data.snapshot : null;
  const effectiveTraders = Object.fromEntries(
    (snapshot?.traders ?? []).map((trader) => [
      trader.id,
      effectiveTraderProgress(trader, profile),
    ]),
  );
  const availability = (task: GameSnapshot['tasks'][number]) => {
    const stage = newBeginningStage(task);
    const prestige =
      typeof task.requiredPrestige === 'string'
        ? snapshot?.prestige.find((p) => p.id === task.requiredPrestige)?.prestigeLevel
        : task.requiredPrestige;
    return evaluateAvailability(
      {
        ...task,
        requiredPrestige: prestige ?? task.requiredPrestige,
        exactPrestige: stage === undefined ? undefined : stage - 1,
      },
      {
        ...profile,
        traders: effectiveTraders,
        progressionCounters: snapshot?.progressionCounters,
        progressionRuleRevision: snapshot?.progressionRuleRevision,
      },
    );
  };
  return (
    <GameContext.Provider
      value={{
        database: store.database,
        profile,
        snapshot,
        manifest: data.manifest,
        ready: store.ready,
        loading: !snapshot,
        error: data.error,
        storageError: store.error,
        notices: store.notices,
        edit,
        availability,
        changeMode: (mode) => {
          if (data.manifest)
            updateDatabase((database) =>
              selectMode(
                database,
                mode,
                mode === 'pvp-season' ? data.manifest!.modes[mode].seasonId : null,
              ),
            );
        },
        chooseProfile: (selectedId) =>
          updateDatabase((database) =>
            Object.hasOwn(database.profiles, selectedId) ? { ...database, selectedId } : database,
          ),
        refresh: () => setCheck((value) => value + 1),
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error('GameProvider is required');
  return context;
}
