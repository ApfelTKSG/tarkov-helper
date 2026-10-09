'use client';

import { useState } from 'react';
import { useGame } from '@/app/context/GameContext';
import { objectiveRemaining } from '@/src/domain/task-view';
import { ObjectiveProgress } from './TaskPanel';

export default function RaidView() {
  const { snapshot, profile } = useGame();
  const [map, setMap] = useState('');
  if (!snapshot) return null;
  const tasks = snapshot.tasks.filter((t) => profile.tasks[t.id] === 'active');
  const objectives = tasks.flatMap((task) =>
    task.objectives
      .filter(
        (obj) =>
          !obj.optional &&
          objectiveRemaining(task, obj.id, profile) > 0 &&
          (map ? (obj.maps?.length ? obj.maps : task.map ? [task.map] : []).includes(map) : true),
      )
      .map((objective) => ({ task, objective })),
  );
  const keyIds = new Set(
    objectives.flatMap(({ task, objective }) => [
      ...(objective.requiredKeys ?? []).flat(),
      ...(task.neededKeys ?? [])
        .filter((keys) => !map || keys.map === map)
        .flatMap((keys) => keys.keys),
    ]),
  );
  const markers = new Map<string, number>();
  for (const { task, objective } of objectives)
    if (objective.markerItem)
      markers.set(
        objective.markerItem,
        (markers.get(objective.markerItem) ?? 0) + objectiveRemaining(task, objective.id, profile),
      );
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">レイド準備</h2>
      <label className="flex flex-wrap items-center gap-3">
        マップ
        <select
          className="rounded border border-slate-600 bg-slate-900 p-2"
          value={map}
          onChange={(e) => setMap(e.target.value)}
        >
          <option value="">全マップ・マップ不明</option>
          {snapshot.maps.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-slate-300">
        受注中のタスクから未達の必須目標を表示します。代替キーは候補として表示し、同じキーは1行にまとめます。
      </p>
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <h3 className="font-semibold">持ち物候補</h3>
        <ul className="mt-2 text-sm">
          {[...keyIds].map((id) => (
            <li key={id}>キー候補: {snapshot.items[id]?.name ?? id}（再利用・重複を集約）</li>
          ))}
          {[...markers].map(([id, count]) => (
            <li key={id}>
              消耗品: {snapshot.items[id]?.name ?? id} × {count}
            </li>
          ))}
        </ul>
        {!keyIds.size && !markers.size && (
          <p className="text-slate-400">収録されたキー・マーカー指定はありません。</p>
        )}
      </div>
      {objectives.map(({ task, objective }) => (
        <article
          key={`${task.id}:${objective.id}`}
          className="rounded-xl border border-slate-700 bg-slate-800 p-4"
        >
          <h3 className="mb-2 font-semibold">{task.name}</h3>
          <ObjectiveProgress taskId={task.id} objective={objective} />
          {objective.weapons?.length ? (
            <p className="mt-2 text-sm">
              武器候補: {objective.weapons.map((id) => snapshot.items[id]?.name ?? id).join(' / ')}
            </p>
          ) : null}
          {objective.wearing?.length ? (
            <p className="mt-2 text-sm">
              装備の指定:{' '}
              {objective.wearing
                .map((group) => group.map((id) => snapshot.items[id]?.name ?? id).join(' / '))
                .join(' ＋ ')}
            </p>
          ) : null}
        </article>
      ))}
      {!objectives.length && (
        <p className="text-slate-400">
          対象の未完了目標はありません。タスクの状態を受注中にするとここに表示されます。
        </p>
      )}
    </section>
  );
}
