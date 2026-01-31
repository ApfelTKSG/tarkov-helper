/**
 * Tarkov Helper - Escape from Tarkov task management tool
 * Copyright (C) 2024-2026 ApfelTKSG
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * Data provided by tarkov-api: https://github.com/the-hideout/tarkov-api
 */

// Check available task fields
const fs = require('fs');
const url = "https://api.tarkov.dev/graphql";

// より詳細なクエリ（依存関係を含む）
const query = `
{
  tasks {
    id
    name
    trader {
      name
    }
    minPlayerLevel
    experience
    taskRequirements {
      task {
        id
        name
      }
      status
    }
    objectives {
      id
      description
      type
    }
  }
}
`;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query })
})
  .then(res => res.json())
  .then(data => {
    const tasks = data.data.tasks;

    // タスクマップを作成
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    // 汎用的な再帰的要件収集関数
    const collectRequirements = (taskId, titleRequirements) => {
      const task = taskMap.get(taskId);
      if (!task) return;

      task.taskRequirements.forEach(req => {
        if (!titleRequirements.has(req.task.id)) {
          titleRequirements.add(req.task.id);
          collectRequirements(req.task.id, titleRequirements);
        }
      });
    };

    // Collectorタスク (Kappa)
    const collectorTask = tasks.find(t => t.name === 'Collector');
    const collectorRequirements = new Set();

    if (collectorTask) {
      collectRequirements(collectorTask.id, collectorRequirements);
      console.log(`\n✅ Collectorタスクの前提タスク数: ${collectorRequirements.size}`);
    }

    // Getting Acquaintedタスク (Lightkeeper)
    const lightkeeperTask = tasks.find(t => t.name === 'Getting Acquainted');
    const lightkeeperRequirements = new Set();

    if (lightkeeperTask) {
      collectRequirements(lightkeeperTask.id, lightkeeperRequirements);
      console.log(`✅ Getting Acquaintedタスクの前提タスク数: ${lightkeeperRequirements.size}`);
    }

    // 各タスクにフラグを追加
    tasks.forEach(task => {
      task.isCollectorRequirement = collectorRequirements.has(task.id) || (collectorTask && task.id === collectorTask.id);
      task.isLightkeeperRequirement = lightkeeperRequirements.has(task.id) || (lightkeeperTask && task.id === lightkeeperTask.id);
    });

    // 依存関係があるタスクを抽出
    const tasksWithRequirements = tasks.filter(t => t.taskRequirements.length > 0);

    console.log(`✅ Total tasks: ${tasks.length}`);
    console.log(`✅ 依存関係があるタスク: ${tasksWithRequirements.length}\n`);

    // 完全なデータを保存
    fs.writeFileSync('data/tarkov-tasks.json', JSON.stringify(data.data, null, 2));
    console.log('✅ 依存関係を含む完全データを保存: data/tarkov-tasks.json\n');

    // 依存関係がある最初の3つのタスクを表示
    console.log('📋 依存関係があるタスクの例:\n');
    tasksWithRequirements.slice(0, 3).forEach((task, index) => {
      console.log(`${index + 1}. ${task.name} (${task.trader.name})`);
      console.log(`   必要タスク数: ${task.taskRequirements.length}`);
      task.taskRequirements.forEach(req => {
        console.log(`   - ${req.task.name} (${req.status})`);
      });
      console.log('');
    });
  })
  .catch(err => console.error('Error:', err));
