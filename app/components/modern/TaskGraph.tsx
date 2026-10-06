'use client';

import { useState } from 'react';
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
import { ancestorIds } from '@/src/domain/task-view';
import { loyaltyColumns, taskLoyaltyColumn } from '@/src/domain/task-columns';
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
  const columns = new Map<number, number>();
  const nodes: Node[] = tasks.map((task) => {
    const column = taskLoyaltyColumn(task);
    const index = loyaltyColumns.findIndex((c) => c.key === column);
    const row = columns.get(column) ?? 0;
    columns.set(column, row + 1);
    const result = availability(task);
    const state = profile.tasks[task.id] ?? 'unstarted';
    return {
      id: task.id,
      position: { x: index * 300, y: 70 + row * 120 },
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
  nodes.unshift(
    ...loyaltyColumns.map((column, index) => ({
      id: `ll-heading-${column.key}`,
      position: { x: index * 300, y: 0 },
      data: { label: `${column.label} (${columns.get(column.key) ?? 0}件)` },
      type: 'default',
      selectable: false,
      style: {
        width: 240,
        background: '#0f172a',
        color: '#fbbf24',
        fontWeight: 700,
        border: '1px solid #475569',
        pointerEvents: 'none' as const,
      },
    })),
  );
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
      aria-label="LL別タスクグラフ"
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
