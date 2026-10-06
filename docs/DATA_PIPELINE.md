# ゲームデータの更新基盤

## 実装状況

`codex/tarkov-modernization`で、改修計画のデータ基盤と条件判定を実装した。既存のグラフ・FiR画面はまだ旧データと旧保存形式を利用する。新スナップショットの画面接続、プロフィール移行、追加機能のUIは後続段階で対応する。

データ元は [tarkov.dev JSON API](https://json.tarkov.dev/endpoints)。通常、PvE、PvPシーズンの3モードを独立して保存する。シーズンIDが変わってもユーザーの進捗を自動削除しない。

## ローカル実行

Node.js 24とnpmを使用する。追加のAPIキーは不要。

```sh
npm ci
npm test
npm run typecheck
npm run data:update
```

単一モードを確認する場合:

```sh
npm run data:update -- --mode=regular
```

`public/game-data/manifest.json`が採用中の版を示す。各モードのファイル名はデータ内容のSHA-256で、過去版を残して新しいmanifestを最後に置き換える。差分は追加・削除・変更されたタスクID、関連データの変更有無、直前の版への参照を含む。

`.cache/tarkov-api`に応答本文・ETag・Last-Modifiedを保存し、Gitには含めない。304応答では本文を再取得しない。価格やトレーダーのリセット時刻だけが変わっても、管理対象データの版は変えない。実APIで、全45リソース中43件が304、2件は取得されたが意味のある変更がなく、manifestが書き換わらないことを確認した。

キャッシュがない初回やキャッシュの失効時には全文取得が必要。差分配信APIではないため、ETagが変わったリソースも全文を取得する。全モードのtasks・traders・hideout・items・mapsと日英辞書を、最大3件ずつ並列取得する。

## 検証と障害時

タスク・トレーダー参照、条件種別、翻訳パス、目標ID、以前のスナップショットの整合性を検証する。タスク数の20%超の減少や未対応の条件種別は更新を中止する。会話条件と内部変数はデータを保持し、利用者の確認がない限り解放済みと断定しない。

1モードでも失敗すると、新しいmanifestは公開しない。ネットワーク失敗・429・5xxは回数を制限して再試行する。以前の正常版とキャッシュを残す。中断時に参照されない候補ファイルが残る場合はあるが、manifestの採用版は変わらない。

異常な大幅変更が実際のゲーム仕様変更なら、変更内容を調査して検証ロジック・fixtureを修正する。検証を無効化して自動採用しない。

## GitHub Actions

`.github/workflows/update-game-data.yml`がUTCの0:17、6:17、12:17、18:17（日本時間9:17、15:17、21:17、3:17）に確認する。GitHub側の混雑で実行時刻が遅れる場合がある。API本文とHTTP検証子はActions cacheに保存し、次回復元する。

意味のある変更がある場合だけ、テスト・型チェック・ビルドを通したデータをmainへ通常のpushで保存し、再利用可能なPagesワークフローを呼び出す。GITHUB_TOKENのpushから通常のpushワークフローは発火しないため、明示的な呼び出しで同じデータコミットを配信する。変更がなければコミット・配信を省略する。

有効化には、ワークフローをデフォルトブランチのmainにマージし、Actionsを有効にする。mainへのActionsの書き込みがブランチ保護で禁止されている場合は更新コミットが失敗するため、リポジトリの運用設定を確認する。現在はローカル実装のみで、リモートへのpush・定期実行・公開は行っていない。

仕様の出典: [scheduleの制約](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)、[GITHUB_TOKENによる再帰実行の抑止](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)、[再利用可能ワークフロー](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows)。

## 条件判定

`src/domain/progression.ts`に画面から独立した判定を置く。PMCレベル、実際の前提タスク状態（受注中・完了・失敗）、LL、信頼度、陣営、プレステージ、確認が必要な条件、起点を明示記録した待機時間を扱う。

判定結果は「条件を満たす」「既知の未達条件がある」「確認が必要」の3状態。手動で記録したゲーム内の受注可否は別に保持し、既知の不足理由を消さない。未入力の信頼度を0とみなさず、LL計算にも未解放・不明を反映する。APIの内部変数から未検証の配布グループのOR条件を推測しない。

20件のテストで、条件の境界値、未知条件、304・HTTP失敗、翻訳と代替品の保持、内容ハッシュ、モード途中の失敗、以前の版の破損を確認する。全体の既存lintには未修正の問題があるため、CIでは現段階の新規モジュールにlintを適用し、全体の型チェックとビルドも実行する。
