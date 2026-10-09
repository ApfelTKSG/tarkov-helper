export type TaskState = 'unstarted' | 'active' | 'complete' | 'failed';
export interface TraderProgress {
  level?: number;
  reputation?: number;
  unlocked?: boolean;
}
export interface ProgressProfile {
  progressionRuleRevision?: string;
  progressionCounters?: Record<string, ProgressionCounter>;
  level?: number;
  faction?: 'USEC' | 'BEAR';
  prestige?: number;
  tasks: Record<string, TaskState>;
  traders: Record<string, TraderProgress>;
  confirmedRequirements?: Record<string, boolean>;
  confirmedAvailable?: Record<string, boolean>;
  completedAt?: Record<string, number>;
  delayStartedAt?: Record<string, number>;
}
export interface TaskDefinition {
  id: string;
  minPlayerLevel?: number;
  factionName?: string;
  requiredPrestige?: number | { prestigeLevel?: number } | string;
  exactPrestige?: number;
  taskRequirements: { task: string; status: string[] }[];
  traderRequirements: {
    id?: string;
    trader: string;
    requirementType: string;
    compareMethod: string;
    value: number;
  }[];
  otherRequirements?: { id?: string; type: string; [key: string]: unknown }[];
  availableDelaySecondsMin?: number;
  availableDelaySecondsMax?: number;
}
export interface ConditionResult {
  counter?: {
    completed: number;
    required: number;
    taskIds: string[];
    proof: string[];
    derived: boolean;
  };
  kind: string;
  state: 'met' | 'unmet' | 'unknown';
  message: string;
  reference?: string;
}
export interface ProgressionCounter {
  revision: string;
  verification: 'verified' | 'unresolved';
  coverage: 'complete' | 'partial';
  taskIds: string[];
  proof: string[];
}
export interface Availability {
  state: 'eligible' | 'blocked' | 'unknown';
  conditions: ConditionResult[];
  confirmedInGame: boolean;
}

export function compareNumber(
  actual: number,
  operator: string,
  required: number,
): boolean | undefined {
  if (!Number.isFinite(actual) || !Number.isFinite(required)) return undefined;
  switch (operator) {
    case '>=':
      return actual >= required;
    case '<=':
      return actual <= required;
    case '>':
      return actual > required;
    case '<':
      return actual < required;
    case '=':
      return actual === required;
    default:
      return undefined;
  }
}

/** Task state and predicted eligibility are independent. No progression is inferred. */
export function evaluateAvailability(
  task: TaskDefinition,
  profile: ProgressProfile,
  now = Date.now(),
): Availability {
  const conditions: ConditionResult[] = [];
  const add = (kind: string, met: boolean | undefined, message: string, reference?: string) => {
    conditions.push({
      kind,
      state: met === undefined ? 'unknown' : met ? 'met' : 'unmet',
      message,
      reference,
    });
  };
  if ((task.minPlayerLevel ?? 0) > 0)
    add(
      'playerLevel',
      profile.level === undefined ? undefined : profile.level >= task.minPlayerLevel!,
      `PMCレベル ${task.minPlayerLevel} 以上`,
    );
  for (const req of task.taskRequirements)
    add(
      'task',
      req.status.includes(profile.tasks[req.task] ?? 'unstarted'),
      `前提タスク: ${req.status.join(' / ')}`,
      req.task,
    );
  for (const req of task.traderRequirements) {
    const trader = profile.traders[req.trader];
    const value =
      req.requirementType === 'level'
        ? trader?.level
        : req.requirementType === 'reputation'
          ? trader?.reputation
          : undefined;
    add(
      req.requirementType,
      req.requirementType === 'level' && trader?.unlocked === false
        ? false
        : value === undefined
          ? undefined
          : compareNumber(value, req.compareMethod, req.value),
      `${req.requirementType === 'level' ? 'LL' : '信頼度'} ${req.compareMethod} ${req.value}`,
      req.trader,
    );
  }
  if (task.factionName && task.factionName !== 'Any')
    add(
      'faction',
      profile.faction === undefined ? undefined : profile.faction === task.factionName,
      `陣営 ${task.factionName}`,
    );
  if (task.exactPrestige !== undefined) {
    add(
      'prestige',
      profile.prestige === undefined ? undefined : profile.prestige === task.exactPrestige,
      `現在のプレステージ ${task.exactPrestige}`,
    );
  } else if (task.requiredPrestige !== undefined) {
    const required =
      typeof task.requiredPrestige === 'number'
        ? task.requiredPrestige
        : typeof task.requiredPrestige === 'object'
          ? task.requiredPrestige?.prestigeLevel
          : undefined;
    add(
      'prestige',
      required === undefined || profile.prestige === undefined
        ? undefined
        : profile.prestige >= required,
      required === undefined ? 'プレステージ条件を確認' : `プレステージ ${required} 以上`,
    );
  }
  for (const req of task.otherRequirements ?? []) {
    const key = req.id ? `${task.id}:${req.id}` : undefined;
    const counter =
      req.type === 'globalVariable' && typeof req.variableId === 'string'
        ? profile.progressionCounters?.[req.variableId]
        : undefined;
    const automatic =
      counter?.verification === 'verified' &&
      counter.coverage === 'complete' &&
      profile.progressionRuleRevision === counter.revision &&
      counter.taskIds.length > 0;
    const completed = counter?.taskIds.filter((id) => profile.tasks[id] === 'complete').length ?? 0;
    const required = typeof req.value === 'number' ? req.value : undefined;
    const derived = automatic && required !== undefined && typeof req.compareMethod === 'string';
    const manual = key ? profile.confirmedRequirements?.[key] : undefined;
    add(
      req.type,
      manual ??
        (derived ? compareNumber(completed, req.compareMethod as string, required!) : undefined),
      req.type === 'dialogue'
        ? 'ゲーム内の会話条件を確認'
        : req.type === 'globalVariable'
          ? derived
            ? `対象タスクの完了数 ${completed} / ${required}（${req.compareMethod} ${required}、記録から自動計算${manual === undefined ? '' : '・手動確認を優先'}）`
            : counter
              ? '対象タスクのカウント規則が未解決・不完全、または対応版が異なるためゲーム内で確認'
              : 'ゲーム内の追加解放条件を確認'
          : '未対応の条件を確認',
      key,
    );
    if (counter && required !== undefined)
      conditions[conditions.length - 1].counter = {
        completed,
        required,
        taskIds: counter.taskIds,
        proof: counter.proof,
        derived: !!derived,
      };
  }
  const minimum = task.availableDelaySecondsMin ?? 0;
  const maximum = task.availableDelaySecondsMax ?? minimum;
  if (minimum > 0 || maximum > 0) {
    // Prerequisite completion alone does not prove when a game's timer started.
    const origin = profile.delayStartedAt?.[task.id];
    const elapsed = origin === undefined ? undefined : (now - origin) / 1000;
    const met =
      elapsed === undefined
        ? undefined
        : elapsed < minimum
          ? false
          : elapsed >= maximum
            ? true
            : undefined;
    add(
      'delay',
      met,
      `待機時間 ${minimum}〜${maximum}秒（起点や範囲内の時刻が不明な場合は要確認）`,
    );
  }
  const confirmedInGame = profile.confirmedAvailable?.[task.id] === true;
  return {
    confirmedInGame,
    conditions,
    state: conditions.some((c) => c.state === 'unmet')
      ? 'blocked'
      : conditions.some((c) => c.state === 'unknown')
        ? 'unknown'
        : 'eligible',
  };
}

export function deriveLoyaltyLevel(
  playerLevel: number | undefined,
  reputation: number | undefined,
  levels: { level: number; requiredPlayerLevel: number; requiredReputation: number }[],
  unlocked?: boolean,
): number | undefined {
  if (unlocked === false) return 0;
  if (
    unlocked !== true ||
    playerLevel === undefined ||
    reputation === undefined ||
    !Number.isFinite(playerLevel) ||
    !Number.isFinite(reputation)
  )
    return undefined;
  const eligible = levels.filter(
    (level) => playerLevel >= level.requiredPlayerLevel && reputation >= level.requiredReputation,
  );
  return eligible.length ? Math.max(...eligible.map((level) => level.level)) : 0;
}
