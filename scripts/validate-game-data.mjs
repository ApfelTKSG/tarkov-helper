import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseManifest, verifySnapshot } from '../src/domain/snapshot.ts';

const directory = join(process.cwd(), 'public', 'game-data');
const manifest = parseManifest(
  JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')),
);
for (const [mode, entry] of Object.entries(manifest.modes)) {
  const snapshot = JSON.parse(await readFile(join(directory, entry.file), 'utf8'));
  await verifySnapshot(snapshot, mode, entry.revision, entry.seasonId);
  console.log(`Verified ${mode}: ${entry.revision}`);
}
