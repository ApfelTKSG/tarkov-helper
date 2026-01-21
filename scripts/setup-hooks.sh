#!/bin/bash

# Git hooksをセットアップするスクリプト

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_HOOKS_DIR="$SCRIPT_DIR/../.git/hooks"

echo "📝 Git hooksをセットアップ中..."

# pre-pushフックをコピー
cp "$SCRIPT_DIR/pre-push" "$GIT_HOOKS_DIR/pre-push"
chmod +x "$GIT_HOOKS_DIR/pre-push"

echo "✅ pre-pushフックをインストールしました"
echo "   プッシュ前に自動でDockerビルドテストが実行されます"
echo ""
echo "フックを無効化してプッシュしたい場合："
echo "  git push --no-verify"
