import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchEnvelope } from '../src/data/http-cache.mjs';
import {
  MODES,
  RESOURCES,
  normalizeMode,
  diffSnapshots,
  contentHash,
} from '../src/data/normalize.mjs';

async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function updateGameData({ root = process.cwd(), fetcher, modes = MODES } = {}) {
  if (modes.some((mode) => !MODES.includes(mode))) throw new Error('Unsupported mode');
  const cacheDirectory = join(root, '.cache', 'tarkov-api');
  const output = join(root, 'public', 'game-data');
  const prior = await loadJson(join(output, 'manifest.json'));
  if (prior && prior.schemaVersion !== 1) throw new Error('Unsupported manifest schema');
  const catalog = await fetchEnvelope('endpoints', { cacheDirectory, fetcher });
  if (modes.some((mode) => !catalog.body.data.gameModes?.includes(mode)))
    throw new Error('Upstream no longer supports requested modes');
  const season = modes.includes('pvp-season')
    ? await fetchEnvelope('pvp-season/season', { cacheDirectory, fetcher })
    : null;
  if (season && typeof season.body.data.id !== 'string') throw new Error('Missing season ID');
  const candidates = [];
  // Complete and validate every mode before publishing a new manifest.
  for (const mode of modes) {
    const feeds = {};
    const paths = RESOURCES.flatMap((resource) =>
      ['', '_en', '_ja'].map((suffix) => `${resource}${suffix}`),
    );
    // Bounded concurrency avoids a burst of dozens of full item requests.
    for (let start = 0; start < paths.length; start += 3) {
      const batch = paths.slice(start, start + 3);
      const outcomes = await Promise.allSettled(
        batch.map(async (key) => {
          feeds[key] = await fetchEnvelope(`${mode}/${key}`, { cacheDirectory, fetcher });
        }),
      );
      const failure = outcomes.find((result) => result.status === 'rejected');
      if (failure) throw failure.reason;
    }
    const next = normalizeMode(mode, feeds, mode === 'pvp-season' ? season.body.data.id : null);
    const oldEntry = prior?.modes?.[mode];
    if (oldEntry && !new RegExp(`^${mode}/[a-f0-9]{64}\\.json$`).test(oldEntry.file))
      throw new Error(`${mode}: Invalid snapshot path`);
    const old = oldEntry ? await loadJson(join(output, oldEntry.file)) : null;
    if (oldEntry && (!old || old.revision !== oldEntry.revision))
      throw new Error(`${mode}: Previous snapshot is missing or inconsistent`);
    if (old) {
      const content = { ...old };
      delete content.revision;
      delete content.generatedAt;
      delete content.sources;
      if (contentHash(content) !== old.revision)
        throw new Error(`${mode}: Previous snapshot failed integrity validation`);
    }
    if (old && next.tasks.length < old.tasks.length * 0.8)
      throw new Error(`${mode}: Task count fell by more than 20%; review required`);
    const diff = diffSnapshots(old, next);
    const changed = !old || old.revision !== next.revision;
    candidates.push({
      mode,
      next,
      oldEntry,
      changed,
      diff,
      responses: Object.values(feeds).reduce(
        (stats, feed) => {
          stats[feed.notModified ? 'notModified' : 'downloaded']++;
          return stats;
        },
        { notModified: 0, downloaded: 0 },
      ),
    });
  }
  if (candidates.every((candidate) => !candidate.changed)) {
    return {
      changed: false,
      modes: candidates.map(({ mode, responses }) => ({ mode, ...responses })),
    };
  }
  await mkdir(output, { recursive: true });
  const entries = { ...prior?.modes };
  for (const { mode, next, oldEntry, changed, diff } of candidates) {
    if (!changed) continue;
    const file = `${mode}/${next.revision}.json`;
    await mkdir(join(output, mode), { recursive: true });
    await writeFile(join(output, file), JSON.stringify(next));
    entries[mode] = {
      revision: next.revision,
      file,
      taskCount: next.tasks.length,
      generatedAt: next.generatedAt,
      seasonId: next.seasonId,
      previous: oldEntry ? { revision: oldEntry.revision, file: oldEntry.file } : null,
      diff,
    };
  }
  const manifest = { schemaVersion: 1, updatedAt: new Date().toISOString(), modes: entries };
  const temporary = join(output, `manifest.${process.pid}.tmp`);
  await writeFile(temporary, JSON.stringify(manifest, null, 2));
  await rename(temporary, join(output, 'manifest.json'));
  return {
    changed: true,
    modes: candidates.map(({ mode, next, changed, responses, diff }) => ({
      mode,
      revision: next.revision,
      changed,
      ...responses,
      diff,
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const mode = process.argv.find((arg) => arg.startsWith('--mode='))?.slice(7);
  updateGameData({ modes: mode ? [mode] : MODES })
    .then((result) =>
      console.log(
        JSON.stringify(
          {
            ...result,
            modes: result.modes.map((mode) => ({
              ...mode,
              ...(mode.diff
                ? {
                    diff: {
                      initial: mode.diff.initial,
                      added: mode.diff.added.length,
                      removed: mode.diff.removed.length,
                      changed: mode.diff.changed.length,
                      otherDataChanged: mode.diff.otherDataChanged,
                    },
                  }
                : {}),
            })),
          },
          null,
          2,
        ),
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
