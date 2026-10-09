import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const API_ORIGIN = 'https://json.tarkov.dev';
const allowedPath =
  /^(?:endpoints|status|(?:regular|pve|pvp-season)\/(?:tasks|traders|hideout|items|maps|season)(?:_(?:en|ja))?)$/;

/** Cached payload and validators are stored together, so a 304 always has a body. */
export async function fetchEnvelope(
  path,
  {
    cacheDirectory,
    fetcher = fetch,
    timeoutMs = 20_000,
    attempts = 3,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  } = {},
) {
  if (!allowedPath.test(path)) throw new Error(`Unsupported API path: ${path}`);
  if (!cacheDirectory) throw new Error('cacheDirectory is required');
  const file = join(cacheDirectory, `${path.replaceAll('/', '--')}.json`);
  let cached;
  try {
    const stored = JSON.parse(await readFile(file, 'utf8'));
    if (stored.origin === API_ORIGIN && stored.path === path && stored.body?.data) cached = stored;
  } catch {
    /* Missing or corrupt caches are replaced by an unconditional request. */
  }
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const headers = { Accept: 'application/json' };
      if (cached?.etag) headers['If-None-Match'] = cached.etag;
      else if (cached?.lastModified) headers['If-Modified-Since'] = cached.lastModified;
      const response = await fetcher(`${API_ORIGIN}/${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status === 304) {
        if (!cached) throw new Error(`304 without a cached body: ${path}`);
        return { ...cached, notModified: true };
      }
      if (!response.ok) {
        const error = new Error(`${path}: HTTP ${response.status}`);
        error.retryable = response.status === 429 || response.status >= 500;
        throw error;
      }
      const body = await response.json();
      if (!body || typeof body.data !== 'object' || body.data === null || body.errors) {
        throw new Error(`${path}: Invalid API envelope`);
      }
      const result = {
        origin: API_ORIGIN,
        path,
        body,
        etag: response.headers.get('etag'),
        lastModified: response.headers.get('last-modified'),
        fetchedAt: new Date().toISOString(),
      };
      await mkdir(cacheDirectory, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(result));
      await rename(temporary, file);
      return { ...result, notModified: false };
    } catch (error) {
      lastError = error;
      if (
        error.retryable === false ||
        ['EPERM', 'EACCES', 'ENOSPC'].includes(error.code) ||
        attempt === attempts - 1
      )
        break;
      await sleep(Math.min(500 * 2 ** attempt, 4000));
    }
  }
  throw new Error(`Failed to fetch ${path}: ${lastError?.message}`, { cause: lastError });
}
