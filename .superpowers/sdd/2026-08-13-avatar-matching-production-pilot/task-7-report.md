# Task 7: 会話中・通知・相性レポートUI

## Status

完了。既存デモのワイン、薄桃、白カード、390pxスマホ面をそのまま用い、Realtime進行表示、通知、匿名会話ログ、5軸相性レポートを実装しました。

## RED / GREEN

- RED: report component、Realtime hook、owner report queryの3 suitesがmissing moduleで失敗することを確認しました（exit 1、10.2秒）。
- 通知RED: owner限定既読RPCのmigration欠落で1 failed / 2 passedを確認しました。
- 再開RED: 既存completed runを`startMatch()`が拒否し、1 failed / 2 passedを確認しました。
- GREEN: Task 7個別は6 files / 11 tests passed（exit 0、21.1秒）です。

## 実装

- `useMatchRun`はowner RLS下のmatch runをRealtime `postgres_changes`で購読し、2秒pollをfallback、30秒をtimeoutとします。completed/failed/timed_out/unmountでtimerとchannelを一度だけcleanupします。
- matching画面は冪等な`startMatch()`結果を受け、queued時だけprocess Routeを一度呼びます。処理中、失敗時の再試行、完了後のreport導線を表示します。
- 通知一覧はowner filterで新しい順に取得します。既読化は`auth.uid()`とownerを照合するSECURITY DEFINER RPCだけに限定し、PUBLIC/anonをrevoke、authenticatedだけにexecuteをgrantしました。
- report queryはownerのcompleted run、active候補の`avatar_alias`、report、8件以上のmessages、5 dimensionsだけを取得します。`candidate_reveals`、氏名、会社、部署は参照も表示もしません。
- ConversationLogは話者、本文、`answerRefs`を表示します。CompatibilityReportは5つの`role=meter`、軸方向、不一致の「低いほど良い」、実在発言の引用、総評と注意を表示します。
- Supabase Realtimeの現行公式資料を確認し、`postgres_changes`購読、行filter、`removeChannel` cleanupを採用しました。2026年の関連breaking changeは本ブラウザ実装に影響しません。

## 検証

| 検証 | 結果 |
| --- | --- |
| Task 7 unit/integration | 6 files / 11 tests、exit 0、21.1秒 |
| 型検査 | Node 24、exit 0、14.3秒 |
| Lint | Node 24、exit 0、25.2秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、31.1秒 |
| Playwright | `tests/e2e/matching-report.spec.ts`を作成。既知のrunner停止制約により未実行 |
| DB | Docker未導入のためmigration実DB実行は未実施 |

## 変更ファイル

- `src/features/matching/client/`、`src/features/matching/server/report-query.ts`
- `src/features/notifications/server/queries.ts`
- `src/components/report/`
- `src/app/(journey)/matching/`、`notifications/`、`report/`、`journey.module.css`
- `supabase/migrations/202608150001_notification_read.sql`
- `tests/unit/report/`、`tests/unit/matching/`、`tests/integration/matching/`、`tests/integration/notifications/`、`tests/e2e/matching-report.spec.ts`

## 懸念

- E2Eとmigrationは実行環境が整い次第、それぞれPlaywright runnerと`pnpm test:db`で確認が必要です。
- 開示・承諾/辞退UIはTask 8の責務として先取りしていません。
