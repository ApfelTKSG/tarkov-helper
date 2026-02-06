import { loadAllTasks } from './data-loader';
import { TaskData } from '@/app/types/task';

export function getTaskData(): TaskData {
  const tasks = loadAllTasks();
  return { tasks };
}

export function getUniqueTraderNames(taskData: TaskData): string[] {
  return Array.from(new Set(taskData.tasks.map((task) => task.trader.name)));
}
