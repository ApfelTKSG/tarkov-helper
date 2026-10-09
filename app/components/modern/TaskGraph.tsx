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
import { ancestorIds, descendantIds, taskDepths, traderTaskLines } from '@/src/domain/task-view';
import { layeredTaskRows } from '@/src/domain/task-layout';
import { loyaltyColumns, taskLoyaltyPlacement } from '@/src/domain/task-columns';
import { taskFolders, visibleTaskFolders } from '@/src/domain/task-folders';
import { compareGraphTasks, prerequisiteProgress } from '@/src/domain/task-order';
import { taskGraphStatus, taskRewardLabels } from '@/src/domain/task-presentation';
import { toggleTaskCompletion } from '@/src/domain/task-reputation';
import { stateNames } from './TaskPanel';
import CollectorBadge, { COLLECTOR_ID } from './CollectorBadge';
import styles from './TaskGraph.module.css';
import { taskVariantLabel } from '@/src/domain/task-variant';

const HoverContext = createContext<{ hovered: string | null; ancestors: Set<string> | null }>({
  hovered: null,
  ancestors: null,
});
interface TaskNodeData {
  label: ReactNode;
  background: string;
  borderColor: string;
  loyaltyLabel: string;
  loyaltyTitle?: string;
  progressLabel: string;
  progressTitle: string;
  requiredLevel?: number;
  rewards?: ReturnType<typeof taskRewardLabels>;
  collector?: boolean;
  favorite?: boolean;
  opacity?: number;
}
function TaskNode({ id, data }: NodeProps<TaskNodeData>) {
  const { hovered, ancestors } = useContext(HoverContext);
  return (
    <div
      className={`relative rounded-[10px] border-2 p-[10px] pb-6 text-center text-xs text-slate-100 ${data.collector || data.favorite ? 'ring-2 ring-amber-400/80 ring-offset-2 ring-offset-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.25)]' : ''} ${data.rewards ? 'pt-10' : data.requiredLevel ? 'pt-7' : ''}`}
      style={{
        opacity: (data.opacity ?? 1) * (ancestors && !ancestors.has(id) ? 0.25 : 1),
        background: data.background,
        borderColor: hovered === id ? '#38bdf8' : data.borderColor,
      }}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {!!data.requiredLevel && (
        <span className="absolute left-2 top-1 text-[10px] text-slate-300">
          レベル {data.requiredLevel}～
        </span>
      )}
      {data.rewards && (
        <span
          className="absolute right-2 top-1 text-right text-[10px] leading-3 text-slate-300"
          title="完了報酬（APIの基本値）"
        >
          <span className="block">{data.rewards.experience}</span>
          <span className="block">{data.rewards.money}</span>
        </span>
      )}
      {data.label}
      {data.progressLabel && (
        <span
          className="absolute bottom-1 left-2 text-[10px] text-slate-300"
          title={data.progressTitle}
        >
          {data.progressLabel}
        </span>
      )}
      <span
        className="absolute bottom-1 right-2 text-[10px] font-semibold text-amber-300"
        title={data.loyaltyTitle}
      >
        {data.loyaltyLabel}
      </span>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}
function FolderFrame() {
  return (
    <div
      aria-hidden="true"
      className="h-full rounded-xl border-2 border-sky-500/40 bg-sky-950/20"
    />
  );
}
const nodeTypes = { task: TaskNode, folderFrame: FolderFrame };
const edgeTypes = {};
const defaultViewport = { x: 24, y: 24, zoom: 0.85 };

export default function TaskGraph({
  tasks,
  onSelect,
  revealMatches = false,
  selectedId,
  layout = 'split',
}: {
  tasks: GameTask[];
  onSelect: (task: GameTask) => void;
  revealMatches?: boolean;
  selectedId?: string;
  layout?: 'loyalty' | 'depth' | 'split';
}) {
  const { profile, availability, snapshot, edit, storageError, ready } = useGame();
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const folders = useMemo(
    () => (layout !== 'loyalty' ? [] : taskFolders(snapshot?.tasks ?? tasks)),
    [layout, snapshot?.tasks, tasks],
  );
  const depths = useMemo(
    () => (layout === 'depth' ? taskDepths(snapshot?.tasks ?? tasks) : new Map<string, number>()),
    [layout, snapshot?.tasks, tasks],
  );
  const lines = useMemo(
    () => traderTaskLines(snapshot?.tasks ?? tasks, tasks[0]?.trader ?? ''),
    [snapshot?.tasks, tasks],
  );
  const columnForTask = useCallback(
    (task: GameTask) => {
      if (layout === 'depth') return depths.get(task.id) ?? 0;
      if (layout === 'split' && lines.connected.has(task.id))
        return -(lines.depths.get(task.id) ?? 0) - 1;
      return taskLoyaltyPlacement(task, snapshot?.tasks ?? tasks).level;
    },
    [layout, depths, lines, snapshot?.tasks, tasks],
  );
  const graphColumns = useMemo(
    () =>
      layout === 'depth'
        ? [...new Set(tasks.map((task) => depths.get(task.id) ?? 0))]
            .sort((a, b) => a - b)
            .map((key) => ({ key, label: `深さ${key + 1}` }))
        : layout === 'split'
          ? [
              ...[
                ...new Set(
                  tasks
                    .filter((task) => lines.connected.has(task.id))
                    .map((task) => lines.depths.get(task.id) ?? 0),
                ),
              ]
                .sort((a, b) => a - b)
                .map((depth) => ({ key: -depth - 1, label: `ライン · 深さ${depth + 1}` })),
              ...loyaltyColumns.map((column) => ({ ...column, label: `単独 · ${column.label}` })),
            ]
          : loyaltyColumns,
    [layout, tasks, depths, lines],
  );
  const visibleFolders = useMemo(
    () => visibleTaskFolders(folders, tasks, expanded, revealMatches, selectedId),
    [folders, tasks, expanded, revealMatches, selectedId],
  );
  const lineRows = useMemo(() => {
    const lineTasks =
      layout === 'depth' ? tasks : tasks.filter((task) => lines.connected.has(task.id));
    return layeredTaskRows(
      lineTasks,
      new Map(
        lineTasks.map((task) => [
          task.id,
          graphColumns.findIndex((column) => column.key === columnForTask(task)),
        ]),
      ),
    );
  }, [layout, tasks, lines, graphColumns, columnForTask]);
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
    const ancestors = new Set(
      ids
        .flatMap((id) => [...ancestorIds(tasks, id), ...descendantIds(tasks, id)])
        .map(representative),
    );
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
    const addTask = (task: GameTask, folderColumn?: number) => {
      const placement = taskLoyaltyPlacement(task, snapshot?.tasks ?? tasks);
      const column = placement.level;
      const displayColumn = folderColumn ?? columnForTask(task);
      const index = graphColumns.findIndex((c) => c.key === displayColumn);
      const row =
        layout !== 'loyalty' && lineRows.has(task.id)
          ? lineRows.get(task.id)!
          : (columns.get(displayColumn) ?? 0);
      columns.set(displayColumn, row + 1);
      const result = availability(task);
      const state = profile.tasks[task.id] ?? 'unstarted';
      const progress = prerequisiteProgress(task, profile.tasks);
      const presentation = taskGraphStatus(state, result.state);
      nodes.push({
        id: task.id,
        type: 'task',
        position: {
          x: index * 300,
          y: (layout === 'depth' || displayColumn < 0 ? 20 : 70) + row * 120,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          collector: task.id === COLLECTOR_ID,
          favorite: state !== 'complete' && profile.favorites.includes(task.id),
          opacity: presentation.opacity,
          requiredLevel: task.minPlayerLevel,
          rewards: taskRewardLabels(task),
          loyaltyLabel: column ? `LL${column}` : 'LL要確認',
          loyaltyTitle: placement.inheritedFrom.length ? `前提経由 LL${column}` : undefined,
          progressLabel: progress.total ? `前提 ${progress.met}/${progress.total}` : '',
          progressTitle: `満たした前提タスク数 / 全前提タスク数: ${progress.met}/${progress.total}`,
          background: presentation.background,
          borderColor: presentation.borderColor,
          label: (
            <div>
              <strong className={task.id === COLLECTOR_ID ? 'text-amber-200' : undefined}>
                {state !== 'complete' && profile.favorites.includes(task.id) && (
                  <span className="mr-1 text-amber-300" aria-label="お気に入り">
                    ★
                  </span>
                )}
                {task.name}
              </strong>
              {taskVariantLabel(task, snapshot?.tasks ?? tasks) && (
                <div className="mt-1 text-[10px] leading-3 text-sky-200">
                  {taskVariantLabel(task, snapshot?.tasks ?? tasks)}
                </div>
              )}
              {task.id === COLLECTOR_ID && (
                <span className="ml-2">
                  <CollectorBadge />
                </span>
              )}
              {presentation.label && <div className="mt-1 text-xs">{presentation.label}</div>}
            </div>
          ),
        },
        style: {
          width: 240,
        },
      });
    };
    const entries = tasks
      .filter((task) => {
        const folder = folderByTask.get(task.id);
        return !folder || folder.tasks[0].id === task.id;
      })
      .sort(compareGraphTasks);
    for (const task of entries) {
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
      if (folder.expanded)
        nodes.push({
          id: `${folder.id}-frame`,
          type: 'folderFrame',
          position: {
            x: loyaltyColumns.findIndex((c) => c.key === folder.level) * 300 - 12,
            y: 70 + row * 120 - 12,
          },
          data: {},
          selectable: false,
          focusable: false,
          zIndex: -1,
          style: { width: 264, height: (folder.tasks.length + 1) * 120, pointerEvents: 'none' },
        });
      nodes.push({
        id: folder.id,
        type: 'task',
        position: {
          x: loyaltyColumns.findIndex((c) => c.key === folder.level) * 300,
          y: 70 + row * 120,
        },
        data: {
          requiredLevel: folder.tasks[0].minPlayerLevel,
          progressLabel: `完了 ${complete}/${folder.tasks.length}`,
          progressTitle: `完了タスク数 / 格納タスク数: ${complete}/${folder.tasks.length}`,
          loyaltyLabel: folder.levels
            .map((level) => (level ? `LL${level}` : 'LL要確認'))
            .join(' / '),
          background: complete === folder.tasks.length ? '#064e3b' : '#172554',
          borderColor: '#60a5fa',
          label: (
            <div>
              <strong>
                {folder.expanded ? '📂' : '📁'} {folder.tasks[0].name} からのライン
              </strong>
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
      if (folder.expanded) folder.tasks.forEach((task) => addTask(task, folder.level));
    }
    nodes.unshift(
      ...graphColumns.flatMap((column, index) =>
        layout === 'depth' ||
        column.key <= 0 ||
        !tasks.some((task) => columnForTask(task) === column.key)
          ? []
          : [
              {
                id: `${layout}-heading-${column.key}`,
                position: { x: index * 300, y: 0 },
                data: {
                  label: `LL${column.key} (${tasks.filter((t) => columnForTask(t) === column.key).length}件)`,
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
              },
            ],
      ),
    );
    return nodes;
  }, [
    tasks,
    profile.tasks,
    profile.favorites,
    availability,
    snapshot?.tasks,
    folderByTask,
    revealMatches,
    selectedId,
    layout,
    graphColumns,
    columnForTask,
    lineRows,
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
          focusable: false,
          reconnectable: false,
          interactionWidth: 0,
          label: req.status
            .map((status) => stateNames[status as keyof typeof stateNames] ?? status)
            .join(' / '),
          style: { stroke: '#94a3b8' },
          labelStyle: { fill: '#e2e8f0' },
          labelBgStyle: { fill: '#0f172a' },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        })),
    );
    return edges.map((edge) => ({
      ...edge,
      style: {
        ...edge.style,
        opacity:
          !hover.ancestors || (hover.ancestors.has(edge.source) && hover.ancestors.has(edge.target))
            ? 1
            : 0.15,
      },
    }));
  }, [tasks, representative, hover.ancestors]);
  const activateNode = (id: string, details: boolean) => {
    const folder = visibleFolders.find((folder) => folder.id === id);
    if (folder) {
      if (revealMatches || folder.tasks.some((t) => t.id === selectedId)) return;
      setExpanded((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setHovered(null);
      return;
    }
    const task = tasks.find((task) => task.id === id);
    if (!task) return;
    if (details) {
      setHovered(null);
      onSelect(task);
    } else if (ready && !storageError) edit((p) => toggleTaskCompletion(p, task));
  };
  return (
    <HoverContext.Provider value={hover}>
      <div
        className={`${styles.visualEdges} min-h-[320px] flex-1 rounded-xl border border-slate-700 bg-slate-950`}
        aria-label={
          layout === 'depth'
            ? '深さ別タスクグラフ'
            : layout === 'split'
              ? 'タスクラインとLL別タスクグラフ'
              : 'LL別タスクグラフ'
        }
        onKeyDownCapture={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          const id = (event.target as HTMLElement)
            .closest('.react-flow__node-task')
            ?.getAttribute('data-id');
          if (!id) return;
          event.preventDefault();
          event.stopPropagation();
          activateNode(id, event.shiftKey);
        }}
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
          edgesFocusable={false}
          onNodeMouseEnter={onMouseEnter}
          onNodeMouseLeave={onMouseLeave}
          onNodeContextMenu={(event, node) => {
            const task = tasks.find((task) => task.id === node.id);
            if (task) {
              event.preventDefault();
              setHovered(null);
              onSelect(task);
            }
          }}
          onNodeClick={(event, node) => activateNode(node.id, event.shiftKey)}
        >
          <Background color="#334155" />
          <Controls />
        </ReactFlow>
      </div>
    </HoverContext.Provider>
  );
}
