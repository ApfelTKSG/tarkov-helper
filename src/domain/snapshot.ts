import type { GameManifest, GameMode, GameSnapshot } from './game';

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry ?? null)).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function parseManifest(value: unknown): GameManifest {
  const manifest = value as GameManifest;
  if (manifest?.schemaVersion !== 1 || !manifest.modes) throw new Error('未対応のデータ一覧です');
  for (const mode of ['regular', 'pve', 'pvp-season'] as GameMode[]) {
    const entry = manifest.modes[mode];
    if (
      !entry ||
      !/^[a-f0-9]{64}$/.test(entry.revision) ||
      entry.file !== `${mode}/${entry.revision}.json`
    )
      throw new Error('データ一覧の参照が不正です');
    if (entry.previous && entry.previous.file !== `${mode}/${entry.previous.revision}.json`)
      throw new Error('旧版の参照が不正です');
  }
  return manifest;
}
export async function verifySnapshot(
  value: unknown,
  mode: GameMode,
  revision: string,
  seasonId: string | null,
): Promise<GameSnapshot> {
  const snapshot = value as GameSnapshot;
  if (
    snapshot?.schemaVersion !== 1 ||
    snapshot.mode !== mode ||
    snapshot.revision !== revision ||
    snapshot.seasonId !== seasonId ||
    !Array.isArray(snapshot.tasks) ||
    !Array.isArray(snapshot.traders) ||
    !Array.isArray(snapshot.stations) ||
    !Array.isArray(snapshot.maps) ||
    !snapshot.items ||
    !Array.isArray(snapshot.prestige)
  )
    throw new Error('データの形式・モード・シーズンが一致しません');
  const content = Object.fromEntries(
    Object.entries(snapshot).filter(
      ([key]) => !['revision', 'generatedAt', 'sources'].includes(key),
    ),
  );
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(content)),
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (hash !== revision) throw new Error('ゲームデータの整合性を確認できません');
  return snapshot;
}
