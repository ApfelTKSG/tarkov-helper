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

JSON APIによる3モードの最新データをグラフ・一覧・FiR・ハイドアウトで使用します。LL／信頼度などの解放条件、ゲーム内の実際のタスク状態、目標ごとの部分進捗を別々に記録します。内部条件や会話が未確認なら「要確認」と表示します。

通常・PvE・シーズン別のプロフィール、バックアップ復元プレビュー、日英検索、お気に入り、アイテムの必要数と逆引き、レイド準備、データ版の固定を利用できます。旧端末内保存は元のキーを残して通常プロフィールへ移行します。

開発にはNode.js 24を使用します。

```sh
npm ci
npm test
npm run typecheck
npm run data:update
npm run dev
```

更新方式と自動実行の設定は [データ更新手順](docs/DATA_PIPELINE.md)、改修範囲は [改修計画](docs/TARKOV_MODERNIZATION_PLAN.md) を参照してください。

タスク配布グループは [TarkovTrackerの補足JSON](https://github.com/tarkovtracker-org/tarkov-data-overlay) を取り込み、検証済みの対象タスクの完了数を自動計算します。LLの分類、カウント対象一覧と不足数を表示し、未解決の条件には手動確認を残します。Lightkeeperの現在の経路やLL到達による別の解放経路には補完が残っています。端末内の進捗はゲームと自動同期しません。

## License

このプロジェクトは GNU General Public License v3.0 の下でライセンスされています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。

This project uses [tarkov-api](https://github.com/the-hideout/tarkov-api) by The Hideout, which is also licensed under GPL-3.0.

Supplemental progression data is from [tarkov-data-overlay](https://github.com/tarkovtracker-org/tarkov-data-overlay), Copyright (c) 2026 TarkovTracker.org, under the MIT License. See [the retained license notice](docs/TARKOV_DATA_OVERLAY_LICENSE.txt).
