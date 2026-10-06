# タルコフのタスク管理支援アプリ
他のアプリケーションでは、どのタスクが終わったか？に重きが置かれていた。
現状、本アプリケーションの利点として以下の点が挙げられます。
- タスク同士の依存関係がグラフ化されている

これにより、他のサイト・アプリケーションではわかりにくい「前提タスク」がカーソルのホバーだけでわかります！

一方で、
- 詳細の解説
- 必要なFiR品

などは海外Wikiへ丸投げなので、改善していきたいですね。

## Data Source

このアプリケーションは [The Hideout](https://github.com/the-hideout) の [tarkov-api](https://github.com/the-hideout/tarkov-api) を使用してEscape from Tarkovのゲームデータを取得しています。

現在、最新仕様への移行を進めています。JSON APIによる3モードのデータ取得・検証・差分管理と、LL／信頼度などの解放条件判定を追加しました。既存画面はまだ旧データを参照しています。

開発にはNode.js 24を使用します。

```sh
npm ci
npm test
npm run typecheck
npm run data:update
npm run dev
```

更新方式と自動実行の設定は [データ更新手順](docs/DATA_PIPELINE.md)、改修範囲は [改修計画](docs/TARKOV_MODERNIZATION_PLAN.md) を参照してください。

今後は
- インレイド品の管理
- ハイドアウトのFiR品管理
を追加します！

## License

このプロジェクトは GNU General Public License v3.0 の下でライセンスされています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。

This project uses [tarkov-api](https://github.com/the-hideout/tarkov-api) by The Hideout, which is also licensed under GPL-3.0.
