# Tarkov Helper - Docker使用ガイド

## 開発ワークフロー

### 自動ビルドテスト（推奨）

Git pre-pushフックを設定すると、プッシュ前に自動でビルドテストが実行されます：

```bash
./scripts/setup-hooks.sh
```

これで `git push` 実行時に自動的にDockerビルドテストが走ります。ビルドが失敗するとプッシュが中止されます。

フックを一時的に無効化する場合：
```bash
git push --no-verify
```

### 手動ビルドテスト

プッシュ前に手動でテストする場合：

```bash
docker-compose --profile test run --rm build-test
```

これにより、本番環境と同じ条件でビルドが実行されます。エラーが出た場合は、デプロイ前に修正できます。

### 開発環境の起動

```bash
docker-compose up
```

http://localhost:3000 でアクセスできます。

### クリーンビルド

```bash
# Dockerイメージとキャッシュを削除
docker-compose down --rmi all --volumes

# 再ビルド
docker-compose build --no-cache
```

## トラブルシューティング

### ビルドエラーが出た場合

1. まずローカルでDockerビルドをテスト
2. エラーメッセージを確認
3. コードを修正
4. 再度Dockerでテスト
5. 問題なければGitにpush

これにより、GitHub Actions上でのビルドエラーを未然に防げます。
