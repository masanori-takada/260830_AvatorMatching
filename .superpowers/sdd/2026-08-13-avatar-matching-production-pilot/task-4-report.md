# Task 4: 固定20問と回答保存 実装レポート

## Status

実装完了。固定20問、1画面1問、匿名利用者の回答保存、revision競合、マッチング開始後のロック、20 / 20完了表示を実装しました。

## RED / GREEN 証拠

- REDとして `tests/unit/interview/schemas.test.ts` と `tests/integration/interview/actions.test.ts` を先に作成しました。未実装の `@/features/interview/domain`、`schemas`、`server/actions` をimportする契約です。
- 初回実行 `node_modules\.bin\vitest.cmd run ...` は、実装評価前にNode 22の `EPERM: operation not permitted, lstat 'C:\Users\ユーザー'` で停止しました。したがって、import失敗のrunner出力は取得できていません。
- GREENはNode 24の安定経路で `node_modules/vitest/vitest.mjs run tests/unit/interview tests/integration/interview --pool=forks --maxWorkers=1` を実行し、4 files / 9 tests passed、exit 0、16.1秒でした。
- 固定20問（選択15・自由記述5）、選択値、自由記述1〜500文字、空白拒否、revision競合、query変換、1画面1問、20 / 20を検証しています。

## 検証結果

| 検証 | 結果 |
| --- | --- |
| Task 4 unit/integration | 4 files / 9 tests、exit 0 |
| 型検査 | Node 24 `tsc --noEmit`、exit 0、6.3秒 |
| Lint | Node 24 `eslint .`、exit 0、7.2秒 |
| production build | 公開ダミー環境変数付きNode 24、全5 route生成、exit 0、16.4秒 |
| 全unit回帰 | fork 1でも22秒間出力がなく、指示に従い中断 |
| DB pgTAP | Docker環境未導入の既知制約により未実行 |
| Playwright E2E | runnerがworker開始前に停止する既知制約により未実行 |

## 実装概要

- `spec.md` の固定20問をTypeScriptとmigrationへ正確に転記しました。
- `interview_questions` と `interview_answers` に制約、索引、RLS、明示grantを設定しました。
- 回答表への直接書込み権限は与えず、空search_path・本人ID固定の保存RPCだけを更新口にしました。これにより選択肢検証、1〜500文字、revision、ロックを迂回できません。
- 新規保存は `expectedRevision = null`、更新は一致するrevisionのみ成功し、不一致は `STATE_CONFLICT` です。
- 将来の `match_runs` が存在する場合は本人のrun存在を検出し、queued以降の回答変更を拒否します。
- `/start` は既存の匿名認証Actionを使い、認証UIを追加していません。
- `/interview/[order]` はサーバーから本人の回答/revisionを取得して1問だけ表示し、完了時は `/interview/complete` で20 / 20を表示します。

## 変更ファイル

- `supabase/migrations/202608130002_interview.sql`
- `supabase/seed.sql`
- `supabase/tests/database/002_interview.test.sql`
- `src/features/interview/domain.ts`
- `src/features/interview/schemas.ts`
- `src/features/interview/server/actions.ts`
- `src/features/interview/server/queries.ts`
- `src/components/interview/{question-card,choice-answer,text-answer,progress}.tsx`
- `src/components/interview/interview.module.css`
- `src/app/(journey)/start/page.tsx`
- `src/app/(journey)/interview/[order]/page.tsx`
- `src/app/(journey)/interview/complete/page.tsx`
- `src/app/globals.css`
- `tests/unit/interview/*.test.tsx?`
- `tests/integration/interview/*.test.ts`
- `tests/e2e/interview.spec.ts`

## セルフレビューと懸念

- UIは既存デモのワイン色、淡いAI吹き出し、6px進捗、丸い選択肢をCSS Modulesで再構築し、48px以上の操作対象とreduced motionを維持しました。
- anonymous userもSupabase上は`authenticated` roleとして扱い、全owner policyで `(select auth.uid())` を使っています。
- migrationはユーザー指定の固定ファイル名に従いました。DB未実行のため、pgTAPによる実DB上のRLS/revision確認はDocker利用可能時に必要です。
- Playwright E2Eは契約を追加済みですが、この環境ではrunner停止が既知のため未実行です。
