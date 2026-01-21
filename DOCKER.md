# Tarkov Helper - Docker使用ガイド

## 本番ビルドのテスト

GitHub Pagesにデプロイする前に、ローカルで本番ビルドをテストできます。

### 本番ビルドを実行

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
