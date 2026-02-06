// Found in Raid (FiR) アイテムとそれが必要なタスクの型定義

export interface FirItemRequiredByTask {
  taskId: string;
  taskName: string;
  trader: string;
  minPlayerLevel: number;
  count: number;
  optional: boolean;
  isCollectorRequirement?: boolean;
  isLightkeeperRequirement?: boolean;
}

export interface FirItemDetail {
  id: string;
  name: string;
  shortName: string;
  iconLink?: string;
  wikiLink?: string;
  avg24hPrice: number;
  weight: number;
  width: number;
  height: number;
  requiredByTasks: FirItemRequiredByTask[];
}

export interface TaskFirItem {
  itemId: string;
  itemName: string;
  itemShortName: string;
  count: number;
  optional: boolean;
  isFirRequired?: boolean; // Hideout用: FiRが必要かどうか
  objectiveDescription: string;
}

export interface TaskRequirement {
  taskId: string;
  taskName: string;
  status: string[];
}

export interface TaskWithFirItems {
  taskId: string;
  taskName: string;
  trader: string;
  minPlayerLevel: number;
  experience: number;
  wikiLink?: string;
  firItems: TaskFirItem[];
  taskRequirements: TaskRequirement[];
  dependencyCount?: number; // Hideout: number of prerequisite stations
}

export interface FirDataSummary {
  totalTasks: number;
  tasksRequiringFiR: number;
  uniqueFiRItems: number;
  generatedAt: string;
}

export interface FirItemsData {
  summary: FirDataSummary;
  itemsByTask: TaskWithFirItems[];
  itemsIndex: FirItemDetail[];
}

// ユーザーのアイテム所持状態を管理する型
export interface UserFirItemInventory {
  itemId: string;
  itemName: string;
  itemShortName: string;
  ownedCount: number;
  neededCount: number;
  iconLink?: string;
  avg24hPrice: number;
  notes?: string;
  lastUpdated: string;
}

export interface UserFirItemProgress {
  userId?: string;
  inventory: UserFirItemInventory[];
  lastSyncedAt: string;
}
