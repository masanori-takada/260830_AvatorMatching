# Task 6: マッチ処理と原子的レポート確定

## Status

実装完了。owner単位のマッチ開始、最大3回のclaim、privacy境界経由のAI生成、DB再検証と原子的な会話・レポート・5軸・通知確定を実装しました。

## RED / GREEN

- RED: matching migrationとserver modulesが存在せず、SQL静的契約2件とintegration suitesがmissing file/moduleで失敗することを確認しました。
- Route/attempt追加RED: state conflictが500、Zod不正が500となり、completeのattempt検証が存在しない3 failuresを確認しました。
- GREEN: Node 24でSQL静的契約、start Action、process、Routeの4 files / 9 tests passed、exit 0、13.1秒でした。

## 実装内容

- `match_runs`、`conversation_messages`、`compatibility_reports`、`compatibility_dimensions`、`notifications`と3 enum、制約、timestamp/trigger、owner SELECT RLSを追加しました。直接書込権限は付与せず、authenticatedは所有行のSELECTだけです。
- `match_runs`と`notifications`を`supabase_realtime` publicationへ追加しました。
- `start_match_run()`は最初に`lock_current_user_journey()`を呼び、20回答、avatar profile、active candidateを検証します。owner uniqueにより既存runを返します。
- `claim_match_run()`はowner、queued/failed、attempt < 3を検証します。processing/completed再呼出は現在状態を返します。
- `complete_match_run()`はprocessing/attempt、8〜20連番発言、speaker/body、所有回答だけの重複なしanswer refs、5軸一意、score、evidence turnを再検証してから、messages/report/dimensions/2 notifications/completedを同一transactionで確定します。completed再実行はno-opです。
- `fail_match_run()`はprocessing ownerだけを、許可済み4 error codeのいずれかでfailedへ遷移し、例外本文や回答を保存しません。
- `processOwnedMatch()`は`requireUser()`、owner query、`getAiProvider()`のprivacy wrapper、claim/complete/fail RPCを使用します。ログはrun ID・許可code・error名だけで、回答・会話本文を含めません。
- Next 16 RouteはPromise paramsをawaitし、本文を返さずcompleted 200、state conflict 409、invalid output 422、その他500へ写像します。
- `candidate_reveals`への参照・変更はありません。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| Task 6個別 | 4 files / 9 tests、exit 0、13.1秒 |
| 型検査 | Node 24、exit 0、5.6秒 |
| Lint | Node 24、exit 0、8.9秒 |
| production build | 公開ダミー環境変数付きNode 24、exit 0、23.5秒 |
| pgTAP | 11 assertionsを追加。Docker未導入の既知制約により実DBでは未実行 |
| Playwright | 本Taskの対象外かつrunner既知制約により未実行 |

## 変更ファイル

- `supabase/migrations/202608130003_matching.sql`
- `supabase/tests/database/002_match_processing.test.sql`
- `src/features/matching/server/{queries,actions,process}.ts`
- `src/app/api/match-runs/[id]/process/route.ts`
- `tests/integration/matching/{actions,process,route}.test.ts`
- `tests/unit/config/matching-db-contract.test.ts`

## 懸念

- migration/RPCの実Postgres実行はDocker制約により未検証です。Docker利用可能環境で`pnpm test:db`を必ず実行してください。
- 同期Mock処理のみを実装しています。将来の非同期workerでも同じclaim/complete/fail RPCとprivacy wrapperを使用する必要があります。

## Solレビュー限定修正（2026-08-15）

- RED: SQL契約、Mock provider、start Actionの3ファイルで3 tests failed / 5 passedを確認しました。欠落していたプロフィールrevision照合、全発言の非空`answerRefs`、`STALE_PROFILE`のAction境界がそれぞれ失敗理由でした。
- GREEN: Task 6と関連AI契約は6 files / 16 tests passed（exit 0、19.4秒）です。型検査（7.7秒）、Lint（16.1秒）、環境変数付きproduction build（20.3秒）もNode 24でexit 0でした。
- `start_match_run()`はjourney advisory lock取得後、ownerの20回答revision合計と`avatar_profiles.source_revision`を比較し、不一致時は`STALE_PROFILE`でrunを一件も作りません。Server Actionはこれをallow-listed `STATE_CONFLICT`へ変換します。
- `complete_match_run()`はJSON型を`is distinct from`による段階検証へ変更しました。全messageに非空配列`answerRefs`を必須化し、重複を拒否し、全参照がownerの回答に存在すること、全messageのdistinct参照unionが3件以上であることをDB境界で検証します。
- pgTAPは24 assertionsへ拡張し、他ownerのclaim/complete拒否、stale profileとrun作成0、`answerRefs`欠落/null/非array/empty、invalid後の部分書込0、failed再試行とattempt 3上限、completed再実行の冪等性を契約化しました。
- 並行completeは実DBで同時実行できていませんが、owner一致を含む対象run行の`FOR UPDATE`、reportの`match_run_id unique`、dimensionの`(report_id, axis) unique`、単一RPC transactionにより直列化と重複防止を静的確認しました。
- pgTAP実行はDocker未導入の既知制約により未実行です。実行可能環境では`pnpm test:db`による確認が必要です。Playwrightは本限定修正の対象外です。

## AI出力エラー分類の限定修正（2026-08-15）

- RED: 空`answerRefs`、processの失敗分類、RouteのHTTP写像について3 files / 3 failed / 5 passedを確認しました。JSON Schema同期は`minItems`未定義により1 failed / 1 passedでした。
- GREEN: AI＋Task 6回帰は8 files / 46 tests passed（exit 0、26.1秒）です。型検査（16.9秒）、Lint（24.5秒）、環境変数付きproduction build（25.9秒）もNode 24でexit 0でした。
- `answerRefs`はZod、JSON Schema、DBの全境界で1件以上を必須としました。`specs/001-avatar-matching-pilot/contracts/ai-match.schema.json`にも`minItems: 1`を追加し、同期契約テストで保護しています。
- Provider出力のZod検証失敗とDBの`INVALID_OUTPUT`は、安全な`INVALID_OUTPUT`へ正規化して`fail_match_run`へ渡し、Routeは422を返します。ネットワーク障害など予期しないProvider失敗だけを`PROVIDER_ERROR`として記録し、Routeは500を返します。
- pgTAPとPlaywrightは前節と同じ理由で未実行です。本修正の挙動はunit/contract/integrationで検証しました。
