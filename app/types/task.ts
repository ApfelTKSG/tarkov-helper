// Tarkovタスクの型定義

export interface TaskObjective {
  id: string;
  description: string;
  type: string;
}

export interface Trader {
  name: string;
}

export interface TaskRequirement {
  task: {
    id: string;
    name: string;
  };
  status: string;
}

export interface Task {
  id: string;
  name: string;
  trader: Trader;
  minPlayerLevel: number;
  experience: number;
  objectives: TaskObjective[];
  taskRequirements: TaskRequirement[];
  isCollectorRequirement?: boolean;
  isLightkeeperRequirement?: boolean;

  // Integrated types
  type?: 'task' | 'hideout' | 'trader';

  // Hideout specific
  hideoutStationId?: string;
  hideoutLevel?: number;
  constructionTime?: number;

  // Trader specific
  traderId?: string;
  traderLevel?: number;
  requiredReputation?: number;
  requiredCommerce?: number;
}

export interface TaskData {
  tasks: Task[];
}
