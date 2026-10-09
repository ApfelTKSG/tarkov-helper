import type { ProgressProfile } from './progression';
import type { GameMode, GameSnapshot } from './game';

export const STORAGE_KEY = 'tarkov-helper-profiles-v1';
export interface Profile extends ProgressProfile {
  /** Exact deltas already applied; absent legacy entries are never backfilled. */
  taskReputation?: Record<string, Record<string, number>>;
  taskStateBeforeCompletion?: Record<string, 'unstarted' | 'active' | 'failed'>;
  id: string;
  name: string;
  mode: GameMode;
  seasonId: string | null;
  objectiveCounts: Record<string, number>;
  legacyCollected: Record<string, number>;
  favorites: string[];
  hiddenTasks: string[];
  stationLevels: Record<string, number>;
  skills: Record<string, number>;
  pinnedRevision?: string;
  seenRevision?: string;
  dataRevision?: string;
  taskFilter?: 'all' | 'active' | 'favorites';
}
export interface ProfileDatabase {
  schemaVersion: 1;
  selectedId: string;
  profiles: Record<string, Profile>;
  migratedLegacy: boolean;
}
export interface StorageReader {
  getItem(key: string): string | null;
}
const modes: GameMode[] = ['regular', 'pve', 'pvp-season'];
const safeKey = (key: string) => !['__proto__', 'prototype', 'constructor'].includes(key);
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function numberMap(value: unknown, name: string, signed = false) {
  assert(record(value), `${name}の形式が不正です`);
  for (const [key, count] of Object.entries(value))
    assert(
      safeKey(key) && typeof count === 'number' && Number.isFinite(count) && (signed || count >= 0),
      `${name}の値が不正です`,
    );
}
function booleanMap(value: unknown, name: string) {
  if (value === undefined) return;
  assert(
    record(value) &&
      Object.entries(value).every(([key, flag]) => safeKey(key) && typeof flag === 'boolean'),
    `${name}の形式が不正です`,
  );
}
export function profileId(mode: GameMode, seasonId: string | null) {
  return mode === 'pvp-season' ? `${mode}:${seasonId ?? 'unknown'}` : mode;
}
export function createProfile(mode: GameMode, seasonId: string | null): Profile {
  const id = profileId(mode, seasonId);
  return {
    id,
    name: mode === 'regular' ? '通常' : mode === 'pve' ? 'PvE' : `シーズン ${seasonId ?? '不明'}`,
    mode,
    seasonId,
    tasks: {},
    traders: {},
    objectiveCounts: {},
    legacyCollected: {},
    favorites: [],
    hiddenTasks: [],
    stationLevels: {},
    skills: {},
  };
}
export function createDatabase(): ProfileDatabase {
  const profile = createProfile('regular', null);
  return {
    schemaVersion: 1,
    selectedId: profile.id,
    profiles: { [profile.id]: profile },
    migratedLegacy: false,
  };
}

/** Reset the current character's progress; permanent prestige and display choices survive. */
export function resetProfileProgress(profile: Profile): Profile {
  return {
    ...createProfile(profile.mode, profile.seasonId),
    name: profile.name,
    level: 1,
    faction: profile.faction,
    prestige: profile.prestige,
    taskFilter: profile.taskFilter,
    pinnedRevision: profile.pinnedRevision,
    dataRevision: profile.dataRevision,
    seenRevision: profile.seenRevision,
  };
}
export function parseDatabase(text: string): ProfileDatabase {
  assert(text.length <= 10_000_000, 'バックアップが大きすぎます');
  const value: unknown = JSON.parse(text);
  assert(
    record(value) &&
      value.schemaVersion === 1 &&
      typeof value.selectedId === 'string' &&
      typeof value.migratedLegacy === 'boolean' &&
      record(value.profiles),
    '保存形式が未対応です',
  );
  assert(
    Object.keys(value.profiles).length > 0 && Object.keys(value.profiles).length <= 100,
    'プロフィール数が不正です',
  );
  for (const [id, profile] of Object.entries(value.profiles)) {
    assert(
      safeKey(id) &&
        record(profile) &&
        profile.id === id &&
        typeof profile.name === 'string' &&
        modes.includes(profile.mode as GameMode),
      'プロフィールが不正です',
    );
    assert(
      profile.seasonId === null || typeof profile.seasonId === 'string',
      'シーズンIDが不正です',
    );
    assert(
      profileId(profile.mode as GameMode, profile.seasonId as string | null) === id,
      'プロフィールIDが一致しません',
    );
    for (const key of ['level', 'prestige'])
      if (profile[key] !== undefined)
        assert(
          typeof profile[key] === 'number' &&
            Number.isInteger(profile[key]) &&
            profile[key] >= (key === 'level' ? 1 : 0),
          `${key}が不正です`,
        );
    assert(
      profile.faction === undefined || profile.faction === 'USEC' || profile.faction === 'BEAR',
      '陣営が不正です',
    );
    assert(
      profile.taskFilter === undefined ||
        ['all', 'active', 'favorites'].includes(String(profile.taskFilter)),
      '表示フィルターが不正です',
    );
    assert(
      record(profile.tasks) &&
        Object.entries(profile.tasks).every(
          ([key, state]) =>
            safeKey(key) && ['unstarted', 'active', 'complete', 'failed'].includes(String(state)),
        ),
      'タスク状態が不正です',
    );
    assert(record(profile.traders), 'トレーダー設定が不正です');
    if (profile.taskStateBeforeCompletion !== undefined) {
      assert(
        record(profile.taskStateBeforeCompletion) &&
          Object.entries(profile.taskStateBeforeCompletion).every(
            ([id, state]) =>
              safeKey(id) && ['unstarted', 'active', 'failed'].includes(String(state)),
          ),
        '完了前のタスク状態が不正です',
      );
    }
    if (profile.taskReputation !== undefined) {
      assert(record(profile.taskReputation), '信頼度の反映記録が不正です');
      for (const [taskId, deltas] of Object.entries(profile.taskReputation)) {
        assert(safeKey(taskId), '信頼度のタスクIDが不正です');
        numberMap(deltas, '信頼度の反映記録', true);
      }
    }
    for (const [key, trader] of Object.entries(profile.traders)) {
      assert(safeKey(key) && record(trader), 'トレーダー設定が不正です');
      assert(
        trader.level === undefined ||
          (typeof trader.level === 'number' &&
            Number.isInteger(trader.level) &&
            trader.level >= 0 &&
            trader.level <= 4),
        'LLが不正です',
      );
      assert(
        trader.reputation === undefined ||
          (typeof trader.reputation === 'number' && Number.isFinite(trader.reputation)),
        '信頼度が不正です',
      );
      assert(
        trader.unlocked === undefined || typeof trader.unlocked === 'boolean',
        '解放状態が不正です',
      );
    }
    for (const key of ['objectiveCounts', 'legacyCollected', 'stationLevels', 'skills'])
      numberMap(profile[key], key);
    for (const key of ['completedAt', 'delayStartedAt'])
      if (profile[key] !== undefined) numberMap(profile[key], key);
    for (const key of ['favorites', 'hiddenTasks'])
      assert(
        Array.isArray(profile[key]) &&
          profile[key].every((id) => typeof id === 'string' && safeKey(id)),
        `${key}が不正です`,
      );
    for (const key of ['confirmedRequirements', 'confirmedAvailable'])
      booleanMap(profile[key], key);
    for (const key of ['pinnedRevision', 'seenRevision', 'dataRevision'])
      assert(
        profile[key] === undefined ||
          (typeof profile[key] === 'string' && /^[a-f0-9]{64}$/.test(profile[key])),
        `${key}が不正です`,
      );
  }
  assert(
    safeKey(value.selectedId) && Object.hasOwn(value.profiles, value.selectedId),
    '選択プロフィールがありません',
  );
  return value as unknown as ProfileDatabase;
}
export function migrateLegacy(storage: StorageReader): {
  database: ProfileDatabase;
  warnings: string[];
} {
  const database = createDatabase();
  const profile = database.profiles.regular;
  const warnings: string[] = [];
  const read = (key: string): unknown => {
    const text = storage.getItem(key);
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      warnings.push(`${key}は破損しているため、元データを残しました`);
      return undefined;
    }
  };
  const completed = read('tarkov-completed-tasks');
  if (Array.isArray(completed) && completed.every((id) => typeof id === 'string' && safeKey(id)))
    for (const id of completed) profile.tasks[id] = 'complete';
  else if (completed !== undefined) warnings.push('旧完了タスクの形式が不正です');
  const level = read('tarkov-user-level');
  if (typeof level === 'number' && Number.isInteger(level) && level >= 1) profile.level = level;
  const collected = read('tarkov-fir-collected');
  if (Array.isArray(collected))
    for (const entry of collected) {
      if (
        Array.isArray(entry) &&
        typeof entry[0] === 'string' &&
        safeKey(entry[0]) &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] >= 0
      )
        profile.legacyCollected[entry[0]] = entry[1];
      else warnings.push('旧アイテム進捗に未移行の値があります');
    }
  const hidden = read('tarkov-ignored-tasks');
  if (Array.isArray(hidden))
    profile.hiddenTasks = hidden.filter((id) => typeof id === 'string' && safeKey(id));
  database.migratedLegacy = true;
  return { database, warnings };
}
export function selectMode(
  database: ProfileDatabase,
  mode: GameMode,
  seasonId: string | null,
): ProfileDatabase {
  const id = profileId(mode, seasonId);
  return {
    ...database,
    selectedId: id,
    profiles: {
      ...database.profiles,
      [id]: database.profiles[id] ?? createProfile(mode, seasonId),
    },
  };
}
export function resolveLegacyCounts(profile: Profile, snapshot: GameSnapshot): Profile {
  if (profile.mode !== 'regular') return profile;
  const objectiveCounts = { ...profile.objectiveCounts };
  const legacyCollected = { ...profile.legacyCollected };
  for (const task of snapshot.tasks) {
    const objectives = task.objectives.filter(
      (obj) => obj.type === 'giveItem' && obj.foundInRaid && (obj.item || obj.items?.length),
    );
    for (const obj of objectives) {
      const candidates = obj.item ? [obj.item] : obj.items!;
      const matched = candidates.filter((item) =>
        Object.hasOwn(legacyCollected, `${task.id}-${item}`),
      );
      if (
        !matched.length ||
        matched.some(
          (item) =>
            objectives.filter((o) => o.item === item || o.items?.includes(item)).length !== 1,
        )
      )
        continue;
      const key = `${task.id}:${obj.id}`;
      if (!Object.hasOwn(objectiveCounts, key))
        objectiveCounts[key] = Math.min(
          obj.count ?? 1,
          matched.reduce((sum, item) => sum + legacyCollected[`${task.id}-${item}`], 0),
        );
      for (const item of matched) delete legacyCollected[`${task.id}-${item}`];
    }
  }
  // Retain unmatched IDs and legacy hideout counts in backups rather than discarding them.
  for (const station of snapshot.stations)
    for (const level of station.levels) {
      if (profile.tasks[`hideout-${station.normalizedName}-${level.level}`] === 'complete')
        profile = {
          ...profile,
          stationLevels: {
            ...profile.stationLevels,
            [station.id]: Math.max(profile.stationLevels[station.id] ?? 0, level.level),
          },
        };
    }
  return { ...profile, objectiveCounts, legacyCollected };
}
