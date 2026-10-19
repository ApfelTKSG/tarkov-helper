import type { GameSnapshot } from './game';

/** Fallback badges were checked against all levels 1–79 in the JSON items feed. */
export function playerLevelBadge(
  level: number,
  snapshot?: GameSnapshot | null,
): string | undefined {
  if (!Number.isInteger(level) || level < 1) return undefined;
  return (
    snapshot?.playerLevels?.find((entry) => entry.level === level)?.levelBadgeImageLink ??
    `https://assets.tarkov.dev/player-level-group-${Math.min(16, Math.floor(level / 5) + 1)}.png`
  );
}
