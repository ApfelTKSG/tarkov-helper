import { createHash } from 'node:crypto';
export function signedOverlay(extra = {}) {
  const overlay = {
    tasks: {},
    modes: { regular: {}, pve: {}, 'pvp-season': {} },
    progressionCounters: { regular: {}, pve: {}, 'pvp-season': {} },
    ...extra,
    $meta: { version: 'fixture', generated: '2026-10-07T00:00:00Z' },
  };
  overlay.$meta.sha256 = createHash('sha256')
    .update(JSON.stringify(overlay, null, 2))
    .digest('hex');
  return overlay;
}
