# Tarkov Helper Scripts

このフォルダには、Tarkov APIからデータを取得するスクリプトが含まれています。

## スクリプト

### fetch-tasks.js
ゲームのアップデート時に実行して、最新のタスクデータを取得します。

**実行方法:**
```bash
node scripts/fetch-tasks.js
```

**出力:**
- `data/tarkov-tasks.json` - 全タスクデータ（依存関係含む）

**実行タイミング:**
- Tarkovのゲームアップデート後
- 新しいタスクが追加されたとき
- 手動でデータを更新したいとき
