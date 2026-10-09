import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GameManifest, GameSnapshot } from '../domain/game';
import { traderNameToSlug } from '@/app/lib/traderSlug';

export function traderRoutes() {
  const directory = join(process.cwd(), 'public', 'game-data');
  const manifest = JSON.parse(
    readFileSync(join(directory, 'manifest.json'), 'utf8'),
  ) as GameManifest;
  const names = new Set<string>();
  for (const entry of Object.values(manifest.modes)) {
    const snapshot = JSON.parse(readFileSync(join(directory, entry.file), 'utf8')) as GameSnapshot;
    for (const trader of snapshot.traders) names.add(trader.englishName);
  }
  return [...names].sort().map((name) => ({ trader: traderNameToSlug(name) }));
}
