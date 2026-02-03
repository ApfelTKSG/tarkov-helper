# Tarkov Helper Scripts

このフォルダには、Tarkov APIからデータを取得するスクリプトが含まれています。

## スクリプト

### fetch-tasks.js
ゲームのアップデート時に実行して、最新のタスクデータとFound in Raid (FiR) アイテム情報を取得します。

**実行方法:**
```bash
node scripts/fetch-tasks.js
```

**出力:**
- `data/tarkov-tasks.json` - 全タスクデータ（依存関係含む）
- `data/tarkov-fir-items.json` - FiRアイテムが必要なタスクとアイテムの詳細情報

**データ構造 (tarkov-fir-items.json):**
```json
{
  "summary": {
    "totalTasks": 491,
    "tasksRequiringFiR": 79,
    "uniqueFiRItems": 174,
    "generatedAt": "2026-01-21T14:45:00.635Z"
  },
  "itemsByTask": [
    {
      "taskId": "...",
      "taskName": "First in Line",
      "trader": "Therapist",
      "minPlayerLevel": 1,
      "firItems": [
        {
          "itemId": "...",
          "itemName": "AI-2 medikit",
          "count": 2,
          "optional": false
        }
      ]
    }
  ],
  "itemsIndex": [
    {
      "id": "...",
      "name": "AI-2 medikit",
      "shortName": "AI-2",
      "avg24hPrice": 5000,
      "requiredByTasks": [
        {
          "taskId": "...",
          "taskName": "First in Line",
          "trader": "Therapist",
          "count": 2
        }
      ]
    }
  ]
}
```

**取得される情報:**
- タスクの依存関係と前提条件
- Found in Raid (FiR) が必要なアイテムのリスト
- タスク別に必要なFiRアイテム
- アイテム別にどのタスクで必要かの索引
- アイテムの市場価格、重量、サイズなどの詳細情報
- 最も多くのタスクで必要とされるアイテムの統計

**実行タイミング:**
- Tarkovのゲームアップデート後
- 新しいタスクやアイテムが追加されたとき
- 市場価格などの最新情報を取得したいとき
- 手動でデータを更新したいとき
