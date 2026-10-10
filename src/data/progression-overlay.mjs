import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { contentHash } from './normalize.mjs';

export const OVERLAY_URL =
  'https://cdn.jsdelivr.net/gh/tarkovtracker-org/tarkov-data-overlay@main/dist/overlay.json';
export const RULE_REVISION = '1.1.0';
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const safeId = (id) =>
  typeof id === 'string' &&
  id.length > 0 &&
  !['__proto__', 'prototype', 'constructor'].includes(id);

export function verifyOverlay(value) {
  if (!record(value) || !record(value.$meta) || !/^[a-f0-9]{64}$/.test(value.$meta.sha256 ?? ''))
    throw new Error('Overlay metadata is invalid');
  const unsigned = structuredClone(value);
  delete unsigned.$meta.sha256;
  if (
    createHash('sha256')
      .update(JSON.stringify(unsigned, null, 2))
      .digest('hex') !== value.$meta.sha256
  )
    throw new Error('Overlay digest mismatch');
  if (!record(value.progressionCounters) || !record(value.modes))
    throw new Error('Overlay progression schema is missing');
  for (const mode of ['regular', 'pve', 'pvp-season'])
    if (!record(value.progressionCounters[mode]) || !record(value.modes[mode]))
      throw new Error(`Overlay mode missing: ${mode}`);
  return value;
}

/** A conditional request each update; only verified responses replace the last good cache. */
export async function fetchProgressionOverlay({ cacheDirectory, fetcher = fetch } = {}) {
  const file = join(cacheDirectory, 'progression-overlay.json');
  let cached;
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (value.url === OVERLAY_URL) {
      verifyOverlay(value.body);
      cached = value;
    }
  } catch {
    /* An invalid cache is not eligible for a 304. */
  }
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(OVERLAY_URL, {
        headers: {
          Accept: 'application/json',
          ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}),
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 304 && cached) return cached.body;
      if (!response.ok) throw new Error(`Overlay HTTP ${response.status}`);
      if (Number(response.headers.get('content-length')) > 5_000_000)
        throw new Error('Overlay too large');
      const text = await response.text();
      if (text.length > 5_000_000) throw new Error('Overlay too large');
      const body = verifyOverlay(JSON.parse(text));
      await mkdir(cacheDirectory, { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(
        temporary,
        JSON.stringify({ url: OVERLAY_URL, etag: response.headers.get('etag'), body }),
      );
      await rename(temporary, file);
      return body;
    } catch (error) {
      last = error;
      if (['EPERM', 'EACCES', 'ENOSPC'].includes(error.code)) break;
    }
  }
  throw new Error(`Progression overlay update failed: ${last?.message}`, { cause: last });
}

/** Import tier metadata, counters, and regular-mode New Beginning additions. */
export function supplementProgression(snapshot, overlay) {
  verifyOverlay(overlay);
  const next = structuredClone(snapshot);
  // These missing quests are documented only for regular mode; never copy them to PvE.
  if (next.mode === 'regular') {
    const reference = (value) => (typeof value === 'string' ? value : value?.id);
    for (const id of ['new_beginning_prestige_5', 'new_beginning_prestige_6']) {
      if (
        next.tasks.some(
          (task) => task.id === id || task.wikiLink === overlay.tasksAdd?.[id]?.wikiLink,
        )
      )
        continue;
      const source = overlay.tasksAdd?.[id];
      if (!source) continue;
      if (
        !Array.isArray(source.objectives) ||
        !next.traders.some((trader) => trader.id === reference(source.trader))
      )
        throw new Error(`Invalid prestige addition: ${id}`);
      const objectives = source.objectives.map((objective) => {
        if (
          !safeId(objective.id) ||
          !Number.isInteger(objective.count) ||
          objective.count < 1 ||
          typeof objective.description !== 'string'
        )
          throw new Error(`Invalid prestige objective: ${id}`);
        const items = objective.items?.map(reference);
        if (items?.some((item) => !next.items[item]))
          throw new Error(`Missing prestige item: ${id}`);
        return {
          ...objective,
          ...(items ? { items } : {}),
          maps: (objective.maps ?? []).map(reference),
        };
      });
      next.tasks.push({
        ...source,
        id,
        englishName: source.name,
        trader: reference(source.trader),
        objectives,
        taskRequirements: [],
        traderRequirements: [],
        // The supplement does not specify all unlock gates, so don't claim eligibility.
        otherRequirements: [
          {
            id: 'supplement-unlock',
            type: 'unknown',
            description: '補足データの解放条件をゲーム内で確認',
          },
        ],
        finishRewards: {
          traderStanding: (source.finishRewards?.traderStanding ?? []).map((reward) => ({
            ...reward,
            trader: reference(reward.trader),
          })),
          items: (source.finishRewards?.items ?? []).map((reward) => ({
            ...reward,
            item: reference(reward.item),
          })),
        },
      });
    }
  }
  const tasks = new Map(next.tasks.map((t) => [t.id, t]));
  for (const task of next.tasks) {
    const stage = /New_Beginning_\(Prestige_(\d+)\)/.exec(task.wikiLink ?? '')?.[1];
    if (stage) {
      // Some upstream locale bundles give all stages the same or a wrong-language name.
      task.name = `New Beginning · プレステージ ${stage}`;
      task.englishName = 'New Beginning';
    }
  }
  next.progressionCounters = {};
  next.progressionRuleRevision = RULE_REVISION;
  for (const [variableId, entry] of Object.entries(overlay.progressionCounters[next.mode])) {
    if (
      !safeId(variableId) ||
      !record(entry) ||
      !['verified', 'unresolved'].includes(entry.verification) ||
      !['complete', 'partial'].includes(entry.coverage) ||
      typeof entry.revision !== 'string' ||
      entry.derivation?.type !== 'distinctTaskCompletions' ||
      !Array.isArray(entry.derivation.taskIds) ||
      !entry.derivation.taskIds.every(safeId) ||
      !entry.derivation.taskIds.length ||
      new Set(entry.derivation.taskIds).size !== entry.derivation.taskIds.length ||
      !Array.isArray(entry.proof) ||
      !entry.proof.length ||
      !entry.proof.every((p) => typeof p === 'string' && p.startsWith('https://'))
    )
      throw new Error(`Invalid progression counter: ${variableId}`);
    const complete = entry.derivation.taskIds.every((id) => tasks.has(id));
    next.progressionCounters[variableId] = {
      revision: entry.revision,
      verification: complete ? entry.verification : 'unresolved',
      coverage: complete ? entry.coverage : 'partial',
      taskIds: [...entry.derivation.taskIds],
      proof: [...entry.proof],
    };
  }
  for (const task of next.tasks) {
    const patch = { ...overlay.tasks?.[task.id], ...overlay.modes[next.mode].tasks?.[task.id] };
    const tiers = (patch.traderRequirements ?? []).filter(
      (r) => r.requirementType === 'level' && (r.trader?.id ?? r.trader) === task.trader,
    );
    if (tiers.length) {
      if (
        tiers.some(
          (r) =>
            r.compareMethod !== '>=' || !Number.isInteger(r.value) || r.value < 1 || r.value > 4,
        )
      )
        throw new Error(`Invalid overlay loyalty tier: ${task.id}`);
      task.supplementLoyaltyLevel = Math.max(...tiers.map((r) => r.value));
    }
  }
  const content = { ...next };
  delete content.revision;
  delete content.generatedAt;
  delete content.sources;
  next.revision = contentHash(content);
  next.sources.push({
    path: OVERLAY_URL,
    version: overlay.$meta.version,
    sha256: overlay.$meta.sha256,
  });
  return next;
}
