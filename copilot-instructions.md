# Tarkov Helper - Copilot Instructions

## プロジェクト概要
Escape from Tarkovのタスク管理支援アプリケーション。プレイヤーがKappaコンテナを目指すために必要なタスクの進行状況を視覚的に管理できます。

## 技術スタック
- **フレームワーク**: Next.js 16.1.4 (App Router)
- **言語**: TypeScript 5
- **UI**: React 19.2.3
- **スタイリング**: Tailwind CSS 4
- **フロー図**: ReactFlow 11.11.4
- **データソース**: tarkov.dev GraphQL API
- **デプロイ**: GitHub Pages (静的エクスポート)

## プロジェクト構造
```
app/
  components/          # Reactコンポーネント
    TaskDetailModal.tsx       # タスク詳細モーダル
    TaskTreeView.tsx          # タスクツリービュー
    TraderCardProgress.tsx    # トレーダーカード
    TraderTaskSync.tsx        # タスク同期機能
    ProgressStats.tsx         # 進捗統計
  lib/
    taskData.ts        # タスクデータ管理
  types/
    task.ts            # タスク型定義
  traders/[trader]/    # 動的ルート（トレーダー別ページ）
data/
  tarkov-tasks.json    # タスクデータ（GraphQLから取得）
scripts/
  fetch-tasks.js       # タスクデータ取得スクリプト
```

## 主要機能

### 1. タスク管理
- ローカルストレージでタスクの完了状態を管理
- トレーダー別にタスクツリーを表示
- タスクの依存関係を視覚化

### 2. タスク詳細モーダル
- タスク情報の詳細表示
- Wiki連携（Escape from Tarkov Wiki）
- 他トレーダーの前提タスク表示と遷移
- Collectorタスクの前提マーク（κ）

### 3. 強制完了機能 ⭐
ロックされているタスクを強制的に完了にする機能。新規ユーザーがアプリを使い始める際に便利。
- すべての依存タスクを再帰的に取得して一括完了
- 確認ダイアログで誤操作を防止
- ロックされているタスクにのみ表示

### 4. 進捗統計
- 各トレーダーの完了率
- 全体の進捗状況

## 重要な実装詳細

### URL生成のバグ修正
タスク名に`[PVP ZONE]`が含まれる場合、Wiki URLを生成する前に削除する必要があります。

**実装箇所**: `TaskDetailModal.tsx`
```typescript
const cleanedName = task.name
  .replace(/\s*\[PVP ZONE\]$/i, '')  // [PVP ZONE]を削除
  .trim()
  .replace(/ /g, '_');  // スペースをアンダースコアに
```

### タスクデータ構造
```typescript
interface Task {
  id: string;
  name: string;
  trader: Trader;
  minPlayerLevel: number;
  experience: number;
  objectives: TaskObjective[];
  taskRequirements: TaskRequirement[];  // 前提タスク
  isCollectorRequirement?: boolean;     // Collectorタスクの前提かどうか
}
```

### 完了状態の管理
- `localStorage`の`tarkov-completed-tasks`キーに保存
- `Set<string>`でタスクIDを管理
- JSON配列として永続化

### 強制完了の実装
**関数**: `getAllRequiredTasks` (TaskTreeView.tsx)
- 再帰的にすべての依存タスクを取得
- 循環参照を防止（visitedセットで管理）
- すべてのタスクIDを配列で返す

**関数**: `forceCompleteTask` (TaskTreeView.tsx)
- `getAllRequiredTasks`を使用して依存タスクを取得
- 一括でlocalStorageに保存

## 開発ワークフロー

### ブランチ戦略
**重要**: コードに編集を加えるときは、必ず`develop`ブランチから新しいブランチを作成してください。

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name  # 機能追加の場合
git checkout -b fix/your-bug-fix          # バグ修正の場合
```

### ローカル開発
```bash
npm run dev  # http://localhost:3000 で起動
```

### ビルド
```bash
npm run build  # 本番ビルド（静的エクスポート）
```

### Git Hooks
**pre-push hook** (`.git/hooks/pre-push`)
- プッシュ前に自動でDockerビルドテストを実行
- `docker-compose --profile test run --rm -T build-test`
- ビルドが失敗するとプッシュを中止
- コマンドライン、VS Code UI、GitKrakenなど、どのツールからでも動作

### タスクデータの更新
```bash
node scripts/fetch-tasks.js  # tarkov.dev APIから最新データを取得
```

## 環境変数・設定

### 本番ビルド設定
`next.config.ts`:
```typescript
output: 'export',           // 静的エクスポート
basePath: '/tarkov-helper', // GitHub Pagesのサブパス
images: { unoptimized: true }
```

## デプロイ
- GitHub Pagesにデプロイ
- URL: https://apfeltksg.github.io/tarkov-helper/
- ビルド後の`out`ディレクトリをデプロイ

## 注意事項
1. タスク名から`[PVP ZONE]`を削除してからWiki URLを生成すること
2. 循環参照を防ぐため、依存タスクの取得時にvisitedセットを使用すること
3. localStorageの変更は即座に保存すること
4. 本番環境ではbasePath `/tarkov-helper`を考慮すること

## 今後の計画
- インレイド品の管理機能
- ハイドアウトのインレイド品管理機能
