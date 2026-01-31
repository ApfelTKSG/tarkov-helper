import fs from 'fs';
import path from 'path';
import { TaskData } from '@/app/types/task';

export function getTaskData(): TaskData {
  const filePath = path.join(process.cwd(), 'data', 'tarkov-tasks.json');
  const fileContents = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(fileContents);
}

export function getUniqueTraderNames(taskData: TaskData): string[] {
  return Array.from(new Set(taskData.tasks.map((task) => task.trader.name)));
}
