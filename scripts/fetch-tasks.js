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
    
    // 依存関係があるタスクを抽出
    const tasksWithRequirements = tasks.filter(t => t.taskRequirements.length > 0);
    
    console.log(`\n✅ Total tasks: ${tasks.length}`);
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
