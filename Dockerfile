# Node.js公式イメージを使用
FROM node:20-alpine

# 作業ディレクトリを設定
WORKDIR /app

# package.jsonとpackage-lock.jsonをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci

# アプリケーションのソースコードをコピー
COPY . .

# ビルドを実行（本番環境と同じ）
RUN npm run build

# 開発サーバーのポートを公開
EXPOSE 3000

# デフォルトコマンド（開発サーバー起動）
CMD ["npm", "run", "dev"]
