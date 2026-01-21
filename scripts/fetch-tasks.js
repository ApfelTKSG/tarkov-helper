// Tarkov APIからタスクとFiRアイテム情報を取得
const fs = require('fs');
const url = "https://api.tarkov.dev/graphql";

// タスクとFiRアイテム情報を含む詳細なクエリ
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
    wikiLink
    taskRequirements {
      task {
        id
        name
      }
      status
    }
    objectives {
      id
      type
      description
      optional
      ... on TaskObjectiveItem {
        item {
          id
          name
          shortName
          iconLink
          wikiLink
          avg24hPrice
          weight
          width
          height
        }
        items {
          id
          name
          shortName
          iconLink
          wikiLink
          avg24hPrice
          weight
          width
          height
        }
        count
        foundInRaid
        dogTagLevel
        maxDurability
        minDurability
      }
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
    
    // Collectorタスクを見つける
    const collectorTask = tasks.find(t => t.name === 'Collector');
    const collectorRequirements = new Set();
    
    if (collectorTask) {
      // タスクマップを作成
      const taskMap = new Map(tasks.map(t => [t.id, t]));
      
      // 再帰的にCollectorの前提タスクを収集
      const collectRequirements = (taskId) => {
        const task = taskMap.get(taskId);
        if (!task) return;
        
        task.taskRequirements.forEach(req => {
          if (!collectorRequirements.has(req.task.id)) {
            collectorRequirements.add(req.task.id);
            collectRequirements(req.task.id);
          }
        });
      };
      
      collectRequirements(collectorTask.id);
      console.log(`\n✅ Collectorタスクの前提タスク数: ${collectorRequirements.size}`);
    }
    
    // 各タスクにisCollectorRequirementフラグを追加
    tasks.forEach(task => {
      task.isCollectorRequirement = collectorRequirements.has(task.id);
    });
    
    // 依存関係があるタスクを抽出
    const tasksWithRequirements = tasks.filter(t => t.taskRequirements.length > 0);
    
    console.log(`✅ Total tasks: ${tasks.length}`);
    console.log(`✅ 依存関係があるタスク: ${tasksWithRequirements.length}`);
    
    // 完全なデータを保存
    fs.writeFileSync('data/tarkov-tasks.json', JSON.stringify(data.data, null, 2));
    console.log('✅ 依存関係を含む完全データを保存: data/tarkov-tasks.json');
    
    // ====================
    // FiRアイテムの処理
    // ====================
    console.log('\n📦 FiRアイテムデータを処理中...\n');
    
    // FiRアイテムが必要なタスクをフィルタリング
    const tasksRequiringFiR = tasks.filter(task => {
      return task.objectives.some(obj => 
        obj.type === 'giveItem' && obj.foundInRaid === true
      );
    });
    
    console.log(`✅ FiRアイテムが必要なタスク数: ${tasksRequiringFiR.length}`);
    
    // FiRアイテムのリストを作成（重複削除）
    const firItemsMap = new Map();
    const firItemsByTask = [];
    
    tasksRequiringFiR.forEach(task => {
      const firObjectives = task.objectives.filter(obj => 
        obj.type === 'giveItem' && obj.foundInRaid === true
      );
      
      const taskFirItems = [];
      
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
            itemEntry.requiredByTasks.push({
              taskId: task.id,
              taskName: task.name,
              trader: task.trader.name,
              minPlayerLevel: task.minPlayerLevel,
              count: objective.count || 1,
              optional: objective.optional || false
            });
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
    
    // FiRデータを保存
    const firOutputData = {
      summary: {
        totalTasks: tasks.length,
        tasksRequiringFiR: tasksRequiringFiR.length,
        uniqueFiRItems: firItemsMap.size,
        generatedAt: new Date().toISOString()
      },
      itemsByTask: firItemsByTask.sort((a, b) => a.minPlayerLevel - b.minPlayerLevel),
      itemsIndex: Array.from(firItemsMap.values()).sort((a, b) => 
        a.name.localeCompare(b.name)
      )
    };
    
    fs.writeFileSync(
      'data/tarkov-fir-items.json', 
      JSON.stringify(firOutputData, null, 2)
    );
    console.log('✅ FiRアイテムデータを保存: data/tarkov-fir-items.json');
    console.log(`   ・タスク別FiRアイテムリスト: ${firItemsByTask.length}件`);
    console.log(`   ・ユニークFiRアイテム: ${firItemsMap.size}種類`);
    
    // 最も多くのタスクで必要とされるアイテムTOP5
    const sortedByTaskCount = Array.from(firItemsMap.values())
      .sort((a, b) => b.requiredByTasks.length - a.requiredByTasks.length)
      .slice(0, 5);
    
    console.log('\n📋 最も多くのタスクで必要なFiRアイテム TOP5:\n');
    sortedByTaskCount.forEach((item, index) => {
      console.log(`${index + 1}. ${item.name} (${item.shortName})`);
      console.log(`   必要とするタスク数: ${item.requiredByTasks.length}`);
      const totalCount = item.requiredByTasks.reduce((sum, t) => sum + t.count, 0);
      console.log(`   合計必要数: ${totalCount}`);
      console.log(`   平均価格: ₽${item.avg24hPrice.toLocaleString()}\n`);
    });
    
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
  .catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
