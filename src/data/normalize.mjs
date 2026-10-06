import { createHash } from 'node:crypto';

export const MODES = ['regular', 'pve', 'pvp-season'];
export const RESOURCES = ['tasks', 'traders', 'hideout', 'items', 'maps'];
export const SCHEMA_VERSION = 1;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(entry => stableStringify(entry ?? null)).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function contentHash(value) {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

/** Apply only declared JSONPath fields. Never reinterpret IDs or case-fold keys. */
export function translateEnvelope(envelope, primary, fallback = {}) {
  const copy = structuredClone(envelope);
  for (const expression of envelope.translations ?? []) {
    if (typeof expression !== 'string' || !expression.startsWith('$.')) throw new Error(`Unsupported translation path: ${expression}`);
    const tokens = [];
    let offset = 1;
    while (offset < expression.length) {
      if (expression.startsWith('..', offset)) { tokens.push('**'); offset += 2; }
      else if (expression[offset] === '.') offset++;
      if (expression[offset] === '[') {
        const end = expression.indexOf(']', offset);
        const selection = expression.slice(offset + 1, end);
        if (end < 0 || (selection !== '*' && !/^'[^']+'(?:,'[^']+')*$/.test(selection))) throw new Error(`Unsupported translation path: ${expression}`);
        tokens.push(selection === '*' ? '*' : selection.split(',').map(key => key.slice(1, -1)));
        offset = end + 1;
      } else {
        const key = /^[^.[\]]+/.exec(expression.slice(offset))?.[0];
        if (!key) throw new Error(`Unsupported translation path: ${expression}`);
        tokens.push(key); offset += key.length;
      }
    }
    const visit = (node, index) => {
      if (node === null || typeof node !== 'object') return;
      const token = tokens[index];
      if (token === '**') {
        visit(node, index + 1);
        for (const child of Object.values(node)) visit(child, index);
        return;
      }
      const keys = token === '*' ? Object.keys(node) : Array.isArray(token) ? token : [token];
      for (const key of keys) {
        if (!Object.hasOwn(node, key)) continue;
        if (index < tokens.length - 1) { visit(node[key], index + 1); continue; }
        const original = node[key];
        if (typeof original !== 'string') continue;
        const value = primary[original] || fallback[original];
        if (typeof value === 'string' && value.length) node[key] = value;
      }
    };
    visit(copy, 0);
  }
  return copy;
}

function collection(envelope, resource) {
  let result;
  if (resource === 'tasks' || resource === 'items' || resource === 'maps') result = envelope.data?.[resource];
  else result = envelope.data;
  if (!isRecord(result) && !Array.isArray(result)) throw new Error(`${resource}: Expected a collection`);
  const rows = Object.values(result);
  if (!rows.length) throw new Error(`${resource}: Empty collection`);
  if (rows.some(row => !isRecord(row) || typeof row.id !== 'string' || !row.id)) throw new Error(`${resource}: Missing IDs`);
  const ids = rows.map(row => row.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${resource}: Duplicate IDs`);
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function assertTask(task) {
  if (typeof task.name !== 'string' || typeof task.trader !== 'string') throw new Error(`${task.id}: Missing task name/trader`);
  for (const field of ['taskRequirements', 'traderRequirements', 'objectives']) {
    if (!Array.isArray(task[field])) throw new Error(`${task.id}: Invalid ${field}`);
  }
  for (const req of task.taskRequirements) {
    if (typeof req.task !== 'string' || !Array.isArray(req.status) || !req.status.length || req.status.some(s => !['active', 'complete', 'failed'].includes(s))) {
      throw new Error(`${task.id}: Unsupported task status requirement`);
    }
  }
  for (const req of task.traderRequirements) {
    if (typeof req.trader !== 'string' || !Number.isFinite(req.value) || !['>=', '<=', '>', '<', '='].includes(req.compareMethod)) {
      throw new Error(`${task.id}: Invalid trader requirement`);
    }
    if (!['level', 'reputation'].includes(req.requirementType)) throw new Error(`${task.id}: Unknown trader requirement type`);
    if (req.requirementType === 'level' && (!Number.isInteger(req.value) || req.value < 1 || req.value > 4)) throw new Error(`${task.id}: Invalid LL`);
  }
  for (const objective of task.objectives) {
    if (typeof objective.id !== 'string' || typeof objective.type !== 'string') throw new Error(`${task.id}: Invalid objective`);
    if (objective.count != null && (!Number.isFinite(objective.count) || objective.count < 0)) throw new Error(`${task.id}: Invalid objective count`);
  }
  if (new Set(task.objectives.map(o => o.id)).size !== task.objectives.length) throw new Error(`${task.id}: Duplicate objective IDs`);
}

export function normalizeMode(mode, feeds, seasonId = null) {
  if (!MODES.includes(mode)) throw new Error(`Unknown mode ${mode}`);
  const translated = {};
  const english = {};
  for (const resource of RESOURCES) {
    const base = feeds[resource]?.body;
    const ja = feeds[`${resource}_ja`]?.body?.data;
    const en = feeds[`${resource}_en`]?.body?.data;
    if (!base?.data || !isRecord(ja) || !isRecord(en)) throw new Error(`${mode}/${resource}: Incomplete translations/data`);
    translated[resource] = translateEnvelope(base, ja, en);
    english[resource] = new Map(collection(translateEnvelope(base, en), resource).map(row => [row.id, row]));
  }
  const diagnostics = [];
  const tasks = collection(translated.tasks, 'tasks').map(task => {
    assertTask(task);
    for (const req of task.otherRequirements ?? []) {
      if (!['dialogue', 'globalVariable'].includes(req.type)) throw new Error(`${task.id}: Unsupported other requirement ${req.type}`);
      diagnostics.push({ taskId: task.id, requirementId: req.id ?? null, type: req.type, message: 'ゲーム内で確認が必要な条件' });
    }
    return { ...task, englishName: english.tasks.get(task.id)?.name ?? task.name };
  });
  const taskIds = new Set(tasks.map(t => t.id));
  const traders = collection(translated.traders, 'traders').map(t => ({
    id: t.id, name: t.name, englishName: english.traders.get(t.id)?.name ?? t.name,
    normalizedName: t.normalizedName, imageLink: t.imageLink,
    levels: t.levels ?? [], currency: t.currency,
  }));
  const traderIds = new Set(traders.map(t => t.id));
  for (const task of tasks) {
    if (!traderIds.has(task.trader)) throw new Error(`${task.id}: Missing trader ${task.trader}`);
    for (const req of task.taskRequirements) if (!taskIds.has(req.task)) throw new Error(`${task.id}: Missing prerequisite ${req.task}`);
    for (const req of task.traderRequirements) if (!traderIds.has(req.trader)) throw new Error(`${task.id}: Missing required trader ${req.trader}`);
  }
  const stations = collection(translated.hideout, 'hideout');
  const maps = collection(translated.maps, 'maps').map(map => ({
    id: map.id, name: map.name, englishName: english.maps.get(map.id)?.name ?? map.name,
    normalizedName: map.normalizedName,
  }));
  const wantedItems = new Set();
  const include = id => { if (typeof id === 'string') wantedItems.add(id); };
  for (const task of tasks) {
    for (const objective of task.objectives) {
      include(objective.item);
      for (const field of ['items', 'weapon', 'weapons', 'weaponMods', 'wearing', 'notWearing']) {
        for (const item of Array.isArray(objective[field]) ? objective[field].flat(2) : []) include(item);
      }
    }
    for (const reward of task.finishRewards?.items ?? []) include(reward.item);
    for (const key of task.neededKeys ?? []) include(key.key ?? key.item);
  }
  for (const station of stations) for (const level of station.levels ?? []) for (const item of level.itemRequirements ?? []) include(item.item);
  const allItems = new Map(collection(translated.items, 'items').map(item => [item.id, item]));
  const items = {};
  for (const id of [...wantedItems].sort()) {
    const item = allItems.get(id);
    if (!item) { diagnostics.push({ itemId: id, type: 'missingItem', message: 'アイテム詳細が未収録' }); continue; }
    items[id] = {
      id, name: item.name, englishName: english.items.get(id)?.name ?? item.name,
      shortName: item.shortName, iconLink: item.iconLink, wikiLink: item.wikiLink,
      width: item.width, height: item.height, weight: item.weight,
    };
  }
  // Volatile reset times and flea market prices are deliberately not progression data.
  for (const trader of traders) trader.levels = trader.levels.map(level => ({
    level: level.level, requiredPlayerLevel: level.requiredPlayerLevel,
    requiredReputation: level.requiredReputation, requiredCommerce: level.requiredCommerce,
  }));
  const data = { schemaVersion: SCHEMA_VERSION, mode, seasonId, tasks, traders, stations, maps, items,
    questItems: translated.tasks.data.questItems ?? {}, story: translated.tasks.data.story ?? {},
    prestige: translated.tasks.data.prestige ?? [], diagnostics };
  return { ...data, revision: contentHash(data), generatedAt: new Date().toISOString(), sources: RESOURCES.flatMap(resource => ['', '_en', '_ja'].map(suffix => {
    const source = feeds[`${resource}${suffix}`];
    return { path: source.path, etag: source.etag, lastModified: source.lastModified, fetchedAt: source.fetchedAt };
  })) };
}

export function diffSnapshots(previous, next) {
  if (!previous) return { initial: true, added: next.tasks.map(t => t.id), removed: [], changed: [], otherDataChanged: true };
  const oldTasks = new Map(previous.tasks.map(task => [task.id, task]));
  const newTasks = new Map(next.tasks.map(task => [task.id, task]));
  return {
    initial: false,
    added: [...newTasks.keys()].filter(id => !oldTasks.has(id)),
    removed: [...oldTasks.keys()].filter(id => !newTasks.has(id)),
    changed: [...newTasks.keys()].filter(id => oldTasks.has(id) && contentHash(oldTasks.get(id)) !== contentHash(newTasks.get(id))),
    otherDataChanged: ['traders', 'stations', 'maps', 'items', 'seasonId', 'story', 'prestige'].some(field => contentHash(previous[field] ?? null) !== contentHash(next[field] ?? null)),
  };
}
