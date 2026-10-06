'use client';

import {
  createDatabase,
  migrateLegacy,
  parseDatabase,
  STORAGE_KEY,
  type ProfileDatabase,
} from '../domain/profiles';

const initial = { database: createDatabase(), ready: false, error: '', notices: [] as string[] };
let state = initial;
let initialized = false;
let storage: Storage | undefined;
const listeners = new Set<() => void>();
function emit() {
  for (const listener of listeners) listener();
}
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const getSnapshot = () => state;
export const getServerSnapshot = () => initial;

export function initializeStore() {
  if (initialized) return;
  initialized = true;
  try {
    storage = window.localStorage;
    const saved = storage.getItem(STORAGE_KEY);
    const migrated = saved
      ? { database: parseDatabase(saved), warnings: [] }
      : migrateLegacy(storage);
    state = { database: migrated.database, ready: true, error: '', notices: migrated.warnings };
    if (!saved) storage.setItem(STORAGE_KEY, JSON.stringify(state.database));
  } catch (error) {
    state = {
      ...state,
      ready: true,
      error: `進捗を読み込めません。元の保存データは残しています。${error instanceof Error ? error.message : ''}`,
    };
  }
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    if (!event.newValue) {
      state = {
        ...state,
        error: '別タブで保存データが削除されました。再読み込みまたはバックアップの復元が必要です。',
      };
      emit();
      return;
    }
    try {
      state = { ...state, database: parseDatabase(event.newValue), error: '' };
    } catch {
      state = {
        ...state,
        error: '別タブの保存データが不正です。最後に読めた進捗を表示しています。',
      };
    }
    emit();
  });
  emit();
}
export function updateDatabase(
  update: (database: ProfileDatabase) => ProfileDatabase,
  restore = false,
): boolean {
  if (!state.ready || (state.error && !restore)) return false;
  try {
    // Read again before editing so independent-tab updates do not overwrite a stale database.
    const saved = storage?.getItem(STORAGE_KEY);
    const current = !restore && saved ? parseDatabase(saved) : state.database;
    const next = update(current);
    parseDatabase(JSON.stringify(next));
    if (!storage) throw new Error('端末内保存が利用できません');
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = { ...state, database: next, error: '' };
    emit();
    return true;
  } catch (error) {
    state = {
      ...state,
      error: `保存できませんでした。変更は保存されていません。${error instanceof Error ? error.message : ''}`,
    };
    emit();
    return false;
  }
}
