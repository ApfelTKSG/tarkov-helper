import fs from 'fs';
import path from 'path';
import { FirItemsData, FirItemDetail, TaskWithFirItems, TaskFirItem } from '@/app/types/firItem';

let cachedFirData: FirItemsData | null = null;

interface TaskData {
  tasks: Array<{
    id: string;
    name: string;
    trader: { name: string };
    minPlayerLevel: number;
    experience: number;
    wikiLink?: string;
    isCollectorRequirement?: boolean;
    isLightkeeperRequirement?: boolean;
    taskRequirements: Array<{
      task: { id: string; name: string };
      status: string[];
    }>;
    objectives: Array<{
      id: string;
      type: string;
      description: string;
      optional?: boolean;
      count?: number;
      foundInRaid?: boolean;
      item?: {
        id: string;
        name: string;
        shortName: string;
        iconLink?: string;
        wikiLink?: string;
        avg24hPrice?: number;
        weight?: number;
        width?: number;
        height?: number;
      };
      items?: Array<{
        id: string;
        name: string;
        shortName: string;
        iconLink?: string;
        wikiLink?: string;
        avg24hPrice?: number;
        weight?: number;
        width?: number;
        height?: number;
      }>;
    }>;
  }>;
}

export function getFirItemsData(): FirItemsData {
  if (cachedFirData) {
    return cachedFirData;
  }

  const filePath = path.join(process.cwd(), 'data', 'tarkov-tasks.json');
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const taskData: TaskData = JSON.parse(fileContent);

  // FiRアイテムが必要なタスクをフィルタリング
  const tasksRequiringFiR = taskData.tasks.filter(task => {
    return task.objectives.some(obj =>
      obj.type === 'giveItem' && obj.foundInRaid === true
    );
  });

  // FiRアイテムのリストを作成（重複削除）
  const firItemsMap = new Map<string, FirItemDetail>();
  const firItemsByTask: TaskWithFirItems[] = [];

  tasksRequiringFiR.forEach(task => {
    const firObjectives = task.objectives.filter(obj =>
      obj.type === 'giveItem' && obj.foundInRaid === true
    );

    const taskFirItems: TaskFirItem[] = [];

    firObjectives.forEach(objective => {
      // itemまたはitemsフィールドからアイテムを抽出
      const items = objective.item ? [objective.item] : (objective.items || []);

      items.forEach(item => {
        if (item) {
          // 全体のアイテムマップに追加
          if (!firItemsMap.has(item.id)) {
            firItemsMap.set(item.id, {
              id: item.id,
              name: item.name,
              shortName: item.shortName,
              iconLink: item.iconLink,
              wikiLink: item.wikiLink,
              avg24hPrice: item.avg24hPrice || 0,
              weight: item.weight || 0,
              width: item.width || 1,
              height: item.height || 1,
              requiredByTasks: []
            });
          }

          // タスク別のリストに追加
          taskFirItems.push({
            itemId: item.id,
            itemName: item.name,
            itemShortName: item.shortName,
            count: objective.count || 1,
            optional: objective.optional || false,
            objectiveDescription: objective.description
          });

          // アイテムマップにタスク情報を追加
          const itemEntry = firItemsMap.get(item.id);
          if (itemEntry) {
            // 同じタスク名が既に存在するかチェック（プレステージ対応）
            const existingTask = itemEntry.requiredByTasks.find(t => t.taskName === task.name);
            if (existingTask) {
              // 既に同じタスク名が存在する場合は、IDだけ異なる場合があるのでスキップ
              // （プレステージによる同名タスクの重複を防ぐ）
            } else {
              itemEntry.requiredByTasks.push({
                taskId: task.id,
                taskName: task.name,
                trader: task.trader.name,
                minPlayerLevel: task.minPlayerLevel,
                count: objective.count || 1,
                optional: objective.optional || false,
                isCollectorRequirement: task.isCollectorRequirement,
                isLightkeeperRequirement: task.isLightkeeperRequirement
              });
            }
          }
        }
      });
    });

    if (taskFirItems.length > 0) {
      firItemsByTask.push({
        taskId: task.id,
        taskName: task.name,
        trader: task.trader.name,
        minPlayerLevel: task.minPlayerLevel,
        experience: task.experience,
        wikiLink: task.wikiLink,
        firItems: taskFirItems,
        taskRequirements: task.taskRequirements.map(req => ({
          taskId: req.task.id,
          taskName: req.task.name,
          status: req.status
        }))
      });
    }
  });

  // Hideoutアイテムへの参照を追加
  // Note: getHideoutItems relies on data-loader which imports JSONs. 
  // Should be safe as long as we don't have circular imports with types.
  const { getHideoutItems } = require('./data-loader');
  const { items: hideoutItems, details: hideoutDetails } = getHideoutItems();

  // 詳細マップのマージ
  hideoutDetails.forEach((detail: FirItemDetail) => {
    if (!firItemsMap.has(detail.id)) {
      // Initialize with empty requiredByTasks, will be populated via hideoutItems loop
      firItemsMap.set(detail.id, { ...detail, requiredByTasks: [] });
    }
  });

  // タスクリストのマージ & 逆引きマップの更新
  hideoutItems.forEach((task: TaskWithFirItems) => {
    // FiR管理画面ではFiR必須のアイテムのみを表示
    const firOnlyItems = task.firItems.filter(item => item.isFirRequired);

    if (firOnlyItems.length === 0) return; // FiRアイテムがない場合はスキップ

    firItemsByTask.push({
      ...task,
      firItems: firOnlyItems
    });

    firOnlyItems.forEach(item => {
      const itemEntry = firItemsMap.get(item.itemId);
      if (itemEntry) {
        if (!itemEntry.requiredByTasks.find(t => t.taskId === task.taskId)) {
          itemEntry.requiredByTasks.push({
            taskId: task.taskId,
            taskName: task.taskName,
            trader: task.trader,
            minPlayerLevel: task.minPlayerLevel,
            count: item.count,
            optional: item.optional,
            isCollectorRequirement: false,
            isLightkeeperRequirement: false
          });
        }
      }
    });
  });

  cachedFirData = {
    summary: {
      totalTasks: taskData.tasks.length,
      tasksRequiringFiR: tasksRequiringFiR.length,
      uniqueFiRItems: firItemsMap.size,
      generatedAt: new Date().toISOString()
    },
    itemsByTask: firItemsByTask.sort((a, b) => a.minPlayerLevel - b.minPlayerLevel),
    itemsIndex: Array.from(firItemsMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  };

  return cachedFirData;
}

export function getFirItemById(itemId: string) {
  const data = getFirItemsData();
  return data.itemsIndex.find(item => item.id === itemId);
}

export function getTasksByItemId(itemId: string) {
  const item = getFirItemById(itemId);
  return item?.requiredByTasks || [];
}

export function getItemsByTaskId(taskId: string) {
  const data = getFirItemsData();
  const task = data.itemsByTask.find(t => t.taskId === taskId);
  return task?.firItems || [];
}

// アイテムを必要数でソート
export function getSortedItemsByTotalNeeded() {
  const data = getFirItemsData();
  return [...data.itemsIndex].sort((a, b) => {
    const totalA = a.requiredByTasks.reduce((sum, task) => sum + task.count, 0);
    const totalB = b.requiredByTasks.reduce((sum, task) => sum + task.count, 0);
    return totalB - totalA;
  });
}

// アイテムを価格でソート
export function getSortedItemsByPrice() {
  const data = getFirItemsData();
  return [...data.itemsIndex].sort((a, b) => b.avg24hPrice - a.avg24hPrice);
}

// 特定のトレーダーのタスクに必要なアイテムを取得
export function getItemsByTrader(traderName: string) {
  const data = getFirItemsData();
  const itemIds = new Set<string>();

  data.itemsByTask
    .filter(task => task.trader === traderName)
    .forEach(task => {
      task.firItems.forEach(item => itemIds.add(item.itemId));
    });

  return data.itemsIndex.filter(item => itemIds.has(item.id));
}

// レベル範囲内のタスクに必要なアイテムを取得
export function getItemsByLevelRange(minLevel: number, maxLevel: number) {
  const data = getFirItemsData();
  const itemIds = new Set<string>();

  data.itemsByTask
    .filter(task => task.minPlayerLevel >= minLevel && task.minPlayerLevel <= maxLevel)
    .forEach(task => {
      task.firItems.forEach(item => itemIds.add(item.itemId));
    });

  return data.itemsIndex.filter(item => itemIds.has(item.id));
}
