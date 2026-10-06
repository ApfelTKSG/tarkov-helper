'use client';

import { useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  type Node,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { taskDepths, ancestorIds } from '@/src/domain/task-view';
import { availabilityNames, stateNames } from './TaskPanel';

const nodeTypes = {};
const edgeTypes = {};

export default function TaskGraph({
  tasks,
  onSelect,
}: {
  tasks: GameTask[];
  onSelect: (task: GameTask) => void;
}) {
  const { profile, availability } = useGame();
  const [hovered, setHovered] = useState<string | null>(null);
  const ancestors = hovered ? ancestorIds(tasks, hovered) : null;
  const depths = useMemo(() => taskDepths(tasks), [tasks]);
  const columns = new Map<number, number>();
  const nodes: Node[] = tasks.map((task) => {
    const depth = depths.get(task.id) ?? 0;
    const row = columns.get(depth) ?? 0;
    columns.set(depth, row + 1);
    const result = availability(task);
    const state = profile.tasks[task.id] ?? 'unstarted';
    return {
      id: task.id,
      position: { x: depth * 300, y: row * 120 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        label: (
          <div>
            <strong>{task.name}</strong>
            <div className="mt-1 text-xs">
              {stateNames[state]} · {availabilityNames[result.state]}
            </div>
          </div>
        ),
      },
      style: {
        width: 240,
        opacity: ancestors && !ancestors.has(task.id) ? 0.25 : 1,
        background: state === 'complete' ? '#064e3b' : '#1e293b',
        color: '#f1f5f9',
        border: `2px solid ${task.id === hovered ? '#38bdf8' : result.state === 'eligible' ? '#34d399' : result.state === 'blocked' ? '#f87171' : '#fbbf24'}`,
        borderRadius: 10,
      },
    };
  });
  const ids = new Set(tasks.map((task) => task.id));
  const edges: Edge[] = tasks.flatMap((task) =>
    task.taskRequirements
      .filter((req) => ids.has(req.task))
      .map((req) => ({
        id: `${req.task}:${task.id}`,
        source: req.task,
        target: task.id,
        label: req.status
          .map((status) => stateNames[status as keyof typeof stateNames] ?? status)
          .join(' / '),
        style: { stroke: '#94a3b8' },
        labelStyle: { fill: '#e2e8f0' },
        labelBgStyle: { fill: '#0f172a' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      })),
  );
  return (
    <div
      className="h-[550px] rounded-xl border border-slate-700 bg-slate-950"
      aria-label="タスク依存グラフ"
    >
      <ReactFlow
        key={`${profile.id}:${tasks.map((t) => t.id).join(',')}`}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={{ x: 24, y: 24, zoom: 0.85 }}
        minZoom={0.08}
        nodesDraggable={false}
        nodesConnectable={false}
        onNodeMouseEnter={(_, node) => setHovered(node.id)}
        onNodeMouseLeave={() => setHovered(null)}
        onNodeClick={(_, node) => {
          const task = tasks.find((task) => task.id === node.id);
          if (task) onSelect(task);
        }}
      >
        <Background color="#334155" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
