'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  Position,
  Handle,
  type Node,
  type Edge,
  type NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useGame } from '@/app/context/GameContext';
import type { GameTask } from '@/src/domain/game';
import { ancestorIds } from '@/src/domain/task-view';
import { loyaltyColumns, taskLoyaltyPlacement } from '@/src/domain/task-columns';
import { taskFolders, visibleTaskFolders } from '@/src/domain/task-folders';
import { availabilityNames, stateNames } from './TaskPanel';

const HoverContext = createContext<{ hovered: string | null; ancestors: Set<string> | null }>({
  hovered: null,
  ancestors: null,
});
interface TaskNodeData {
  label: ReactNode;
  background: string;
  borderColor: string;
}
function TaskNode({ id, data }: NodeProps<TaskNodeData>) {
  const { hovered, ancestors } = useContext(HoverContext);
  return (
    <div
      className="rounded-[10px] border-2 p-[10px] text-center text-xs text-slate-100"
      style={{
        opacity: ancestors && !ancestors.has(id) ? 0.25 : 1,
        background: data.background,
        borderColor: hovered === id ? '#38bdf8' : data.borderColor,
      }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {data.label}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
const nodeTypes = { task: TaskNode };
const edgeTypes = {};
const defaultViewport = { x: 24, y: 24, zoom: 0.85 };

export default function TaskGraph({
  tasks,
  onSelect,
  revealMatches = false,
  selectedId,
}: {
  tasks: GameTask[];
  onSelect: (task: GameTask) => void;
  revealMatches?: boolean;
  selectedId?: string;
}) {
  const { profile, availability, snapshot } = useGame();
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const folders = useMemo(() => taskFolders(snapshot?.tasks ?? tasks), [snapshot?.tasks, tasks]);
  const visibleFolders = useMemo(
    () => visibleTaskFolders(folders, tasks, expanded, revealMatches, selectedId),
    [folders, tasks, expanded, revealMatches, selectedId],
  );
  const folderByTask = useMemo(
    () =>
      new Map(visibleFolders.flatMap((folder) => folder.tasks.map((t) => [t.id, folder] as const))),
    [visibleFolders],
  );
  const representative = useCallback(
    (id: string) => {
      const folder = folderByTask.get(id);
      return folder && !folder.expanded ? folder.id : id;
    },
    [folderByTask],
  );
  const hover = useMemo(() => {
    if (!hovered) return { hovered, ancestors: null };
    const folder = visibleFolders.find((f) => f.id === hovered);
    const ids = folder ? folder.tasks.map((t) => t.id) : [hovered];
    const ancestors = new Set(ids.flatMap((id) => [...ancestorIds(tasks, id)]).map(representative));
    for (const f of visibleFolders)
      if (f.tasks.some((t) => ancestors.has(t.id))) ancestors.add(f.id);
    return { hovered, ancestors };
  }, [tasks, hovered, visibleFolders, representative]);
  const onMouseEnter = useCallback((_: unknown, node: Node) => setHovered(node.id), []);
  const onMouseLeave = useCallback(
    (_: unknown, node: Node) => setHovered((current) => (current === node.id ? null : current)),
    [],
  );
  // Keep the measured graph intact on hover. Replacing nodes without their measured
  // dimensions hides them until ResizeObserver runs, triggering leave/enter repeatedly.
  const nodes = useMemo(() => {
    const columns = new Map<number, number>();
    const nodes: Node[] = [];
    const emitted = new Set<string>();
    const addTask = (task: GameTask) => {
      const placement = taskLoyaltyPlacement(task, snapshot?.tasks ?? tasks);
      const column = placement.level;
      const index = loyaltyColumns.findIndex((c) => c.key === column);
      const row = columns.get(column) ?? 0;
      columns.set(column, row + 1);
      const result = availability(task);
      const state = profile.tasks[task.id] ?? 'unstarted';
      nodes.push({
        id: task.id,
        type: 'task',
        position: { x: index * 300, y: 70 + row * 120 },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          background: state === 'complete' ? '#064e3b' : '#1e293b',
          borderColor:
            result.state === 'eligible'
              ? '#34d399'
              : result.state === 'blocked'
                ? '#f87171'
                : '#fbbf24',
          label: (
            <div>
              <strong>{task.name}</strong>
              <div className="mt-1 text-xs">
                {stateNames[state]} · {availabilityNames[result.state]}
              </div>
              {!!placement.inheritedFrom.length && (
                <div className="mt-1 text-xs text-slate-300">前提経由 LL{column}</div>
              )}
            </div>
          ),
        },
        style: {
          width: 240,
        },
      });
    };
    for (const task of tasks) {
      const folder = folderByTask.get(task.id);
      if (!folder) {
        addTask(task);
        continue;
      }
      if (emitted.has(folder.id)) continue;
      emitted.add(folder.id);
      const row = columns.get(folder.level) ?? 0;
      columns.set(folder.level, row + 1);
      const complete = folder.tasks.filter((t) => profile.tasks[t.id] === 'complete').length;
      nodes.push({
        id: folder.id,
        type: 'task',
        position: {
          x: loyaltyColumns.findIndex((c) => c.key === folder.level) * 300,
          y: 70 + row * 120,
        },
        data: {
          background: complete === folder.tasks.length ? '#064e3b' : '#172554',
          borderColor: '#60a5fa',
          label: (
            <div>
              <strong>
                {folder.expanded ? '📂' : '📁'} {folder.tasks[0].name} からのライン
              </strong>
              <div className="mt-1">
                {folder.tasks.length}件 · 完了 {complete}/{folder.tasks.length}
              </div>
              <div className="mt-1 text-sky-300">
                {revealMatches || folder.tasks.some((t) => t.id === selectedId)
                  ? '検索・選択中は自動展開'
                  : folder.expanded
                    ? '折りたたむ'
                    : '展開する'}
              </div>
            </div>
          ),
        },
        style: { width: 240 },
      });
      if (folder.expanded) folder.tasks.forEach(addTask);
    }
    nodes.unshift(
      ...loyaltyColumns.map((column, index) => ({
        id: `ll-heading-${column.key}`,
        position: { x: index * 300, y: 0 },
        data: {
          label: `${column.label} (${tasks.filter((t) => taskLoyaltyPlacement(t, snapshot?.tasks ?? tasks).level === column.key).length}件)`,
        },
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
    return nodes;
  }, [
    tasks,
    profile.tasks,
    availability,
    snapshot?.tasks,
    folderByTask,
    revealMatches,
    selectedId,
  ]);
  const edges = useMemo(() => {
    const ids = new Set(tasks.map((task) => task.id));
    const edges: Edge[] = tasks.flatMap((task) =>
      task.taskRequirements
        .filter((req) => ids.has(req.task) && representative(req.task) !== representative(task.id))
        .map((req) => ({
          id: `${req.task}:${task.id}`,
          source: representative(req.task),
          target: representative(task.id),
          label: req.status
            .map((status) => stateNames[status as keyof typeof stateNames] ?? status)
            .join(' / '),
          style: { stroke: '#94a3b8' },
          labelStyle: { fill: '#e2e8f0' },
          labelBgStyle: { fill: '#0f172a' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        })),
    );
    return edges;
  }, [tasks, representative]);
  return (
    <HoverContext.Provider value={hover}>
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
          defaultViewport={defaultViewport}
          minZoom={0.08}
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeMouseEnter={onMouseEnter}
          onNodeMouseLeave={onMouseLeave}
          onNodeClick={(_, node) => {
            const folder = visibleFolders.find((folder) => folder.id === node.id);
            if (folder) {
              if (revealMatches || folder.tasks.some((t) => t.id === selectedId)) return;
              setExpanded((current) => {
                const next = new Set(current);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
              setHovered(null);
              return;
            }
            const task = tasks.find((task) => task.id === node.id);
            if (task) onSelect(task);
          }}
        >
          <Background color="#334155" />
          <Controls />
        </ReactFlow>
      </div>
    </HoverContext.Provider>
  );
}
