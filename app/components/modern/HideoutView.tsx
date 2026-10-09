'use client';

import { useGame } from '@/app/context/GameContext';
import { evaluateAvailability } from '@/src/domain/progression';
import ItemCard from './ItemCard';

const control = 'rounded border border-slate-600 bg-slate-900 px-2 py-1';
export default function HideoutView({ firOnly = false }: { firOnly?: boolean }) {
  const { snapshot, profile, edit, storageError, availability, ready } = useGame();
  if (!snapshot) return null;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {snapshot.stations.map((station) => {
        const current = profile.stationLevels[station.id] ?? 0;
        const next = station.levels.find((level) => level.level === current + 1);
        if (firOnly && !next?.itemRequirements.some((req) => req.attributes?.foundInRaid))
          return null;
        const prerequisites =
          next?.stationLevelRequirements.map((req) => ({
            name: snapshot.stations.find((s) => s.id === req.station)?.name ?? req.station,
            met: (profile.stationLevels[req.station] ?? 0) >= req.level,
            level: req.level,
          })) ?? [];
        const result = next
          ? availability({
              id: next.id,
              name: station.name,
              englishName: station.name,
              trader: '',
              objectives: [],
              taskRequirements: [],
              traderRequirements: next.traderRequirements,
            })
          : evaluateAvailability(
              { id: station.id, taskRequirements: [], traderRequirements: [] },
              profile,
            );
        return (
          <article key={station.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{station.name}</h2>
              <label className="text-sm">
                建設済みレベル{' '}
                <select
                  aria-label={`${station.name} 建設済みレベル`}
                  className={control}
                  value={current}
                  disabled={!!storageError}
                  onChange={(e) =>
                    edit((p) => ({
                      ...p,
                      stationLevels: { ...p.stationLevels, [station.id]: Number(e.target.value) },
                    }))
                  }
                >
                  {[0, ...station.levels.map((level) => level.level)].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </label>
            </div>
            {next ? (
              <>
                <p className="my-2 text-sm text-slate-300">
                  次の建設: レベル{next.level} ·{' '}
                  {Math.round(((next.constructionTime ?? 0) / 3600) * 10) / 10}時間
                </p>
                <p className="text-sm text-slate-400">{next.description}</p>
                <ul className="my-3 space-y-1 text-sm">
                  {prerequisites.map((req, i) => (
                    <li key={i} className={req.met ? 'text-emerald-300' : 'text-red-300'}>
                      {req.met ? '✓' : '×'} {req.name} レベル{req.level}
                    </li>
                  ))}
                  {result.conditions.map((condition, i) => (
                    <li
                      key={`trader-${i}`}
                      className={condition.state === 'met' ? 'text-emerald-300' : 'text-amber-300'}
                    >
                      {condition.state === 'met' ? '✓' : '?'}{' '}
                      {snapshot.traders.find((t) => t.id === condition.reference)?.name}{' '}
                      {condition.message}
                    </li>
                  ))}
                </ul>
                {next.skillRequirements.map((req) => (
                  <label
                    key={req.id}
                    className="mb-2 flex items-center justify-between gap-2 text-sm"
                  >
                    {req.skill} レベル{req.level}が必要
                    <input
                      aria-label={`${station.name} ${req.skill} レベル`}
                      className={`${control} w-20`}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="不明"
                      value={profile.skills[req.skill] ?? ''}
                      disabled={!!storageError}
                      onChange={(e) => {
                        const value = e.target.value === '' ? undefined : Number(e.target.value);
                        if (value === undefined || (Number.isInteger(value) && value >= 0))
                          edit((p) => {
                            const skills = { ...p.skills };
                            if (value === undefined) delete skills[req.skill];
                            else skills[req.skill] = value;
                            return { ...p, skills };
                          });
                      }}
                    />
                  </label>
                ))}
                <div className="mt-3 space-y-2">
                  {next.itemRequirements
                    .filter((req) => !firOnly || req.attributes?.foundInRaid)
                    .map((req) => {
                      const key = `hideout:${next.id}:${req.id}`;
                      return (
                        <ItemCard
                          key={req.id}
                          title={snapshot.items[req.item]?.name ?? req.item}
                          foundInRaid={req.attributes?.foundInRaid}
                          items={[req.item]}
                          label={`${station.name} ${snapshot.items[req.item]?.name ?? req.item}`}
                          value={Math.min(profile.objectiveCounts[key] ?? 0, req.count)}
                          maximum={req.count}
                          disabled={!ready || !!storageError}
                          onChange={(value) =>
                            edit((p) => ({
                              ...p,
                              objectiveCounts: { ...p.objectiveCounts, [key]: value },
                            }))
                          }
                        />
                      );
                    })}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  確保数はこの建設への割当です。他のタスクや施設と共有しません。建設済みレベルはゲーム内の状態を手動で記録します。
                </p>
              </>
            ) : (
              <p className="mt-3 text-emerald-300">収録されている最終レベルまで建設済み</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
