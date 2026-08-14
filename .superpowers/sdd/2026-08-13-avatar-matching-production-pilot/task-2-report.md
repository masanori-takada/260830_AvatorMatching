# Task 2 実装レポート: Supabase匿名セッションとRLS基盤

## ステータス

実装完了。DB/pgTAPだけはDocker未導入によりローカル実行不能であり、未検証である。成功としては扱わない。

## 実装内容

- Supabase SDKを `@supabase/supabase-js` 2.112.3、SSR SDKを `@supabase/ssr` 0.12.4、CLIを2.114.0へ固定した。
- `test:db` を `supabase test db` に変更した。
- Supabase CLIの `init` と `migration new foundation` で雛形を生成後、計画の固定パスへ移し、匿名サインインを有効化した。
- `profiles`、匿名ユーザー作成時のprofile作成トリガー、更新時刻トリガー、RLS、明示GRANTをmigrationへ追加した。
- RLSは `to authenticated` と `(select auth.uid()) = id` を使い、SELECT/INSERT/UPDATEを自分の行だけに限定した。DELETE権限は付与していない。`id` は主キーかつ外部キーで索引済みである。
- ブラウザ/サーバー/proxy向けのSupabaseクライアント、トークン更新proxy、`requireUser`、冪等な `startAnonymousJourney` を追加した。通常フローでservice roleやsecret keyは使わない。
- 共通の `ActionResult`、`UnauthenticatedError`、内部詳細を公開しないエラー変換、回答本文・トークン等を除外する構造化ログを追加した。
- pgTAP用JWT利用者ヘルパーと、匿名利用者間のprofile分離・他者削除拒否を確認するテストを追加した。

## 変更ファイル

- `package.json`、`pnpm-lock.yaml`
- `supabase/config.toml`
- `supabase/migrations/202608130001_foundation.sql`
- `supabase/tests/database/000_test_helpers.sql`
- `supabase/tests/database/001_rls_foundation.test.sql`
- `src/lib/result.ts`、`src/lib/errors.ts`、`src/lib/logger.ts`
- `src/lib/supabase/client.ts`、`src/lib/supabase/server.ts`、`src/lib/supabase/proxy.ts`、`src/proxy.ts`
- `src/features/identity/server/session.ts`、`src/features/identity/server/actions.ts`
- `tests/unit/lib/result.test.ts`、`tests/unit/lib/errors.test.ts`、`tests/unit/lib/logger.test.ts`
- `tests/unit/features/identity/server/session.test.ts`、`tests/unit/features/identity/server/actions.test.ts`

## RED / GREEN

- pgTAP RED: `pnpm exec supabase test db` は依存導入前にCLI未検出で失敗した。CLI導入後はDocker未導入のためDB接続へ進めず、スキーマ未作成によるREDは観測できなかった。
- 単体RED: `pnpm test tests/unit/lib/result.test.ts tests/unit/lib/errors.test.ts tests/unit/lib/logger.test.ts tests/unit/features/identity/server/session.test.ts tests/unit/features/identity/server/actions.test.ts`。権限付き実行で5 suiteが未実装モジュール解決失敗、exit 1を確認した。
- 単体GREEN: 同じfocusedコマンドを権限付き実行し、5 file / 10 testが成功、exit 0、9.93秒を確認した。

## DBテスト

- `pnpm test:db` を権限付き実行し、`$ supabase test db` が呼ばれることを確認した。
- 結果はexit 1、`LegacyDbConnectError`、`ECONNREFUSED 127.0.0.1:54322`。Dockerが未導入でローカルPostgresが起動していないためである。
- よってmigration、pgTAP、RLSの実DB検証は未実行・未検証であり、PASSではない。Docker導入または開発用ホストSupabaseへmigrationを適用した環境で、同じ `pnpm test:db` を実行する必要がある。

## 全検証

- `pnpm lint`: 成功、exit 0。
- `pnpm typecheck`: 成功、exit 0。
- `pnpm test`: 成功、7 file / 13 test。
- `pnpm test:e2e`: 成功、対象なしを許容、exit 0。
- `pnpm test:visual`: 成功、対象なしを許容、exit 0。
- `pnpm build`: 成功。
- sandbox内では全Nodeコマンドが `EPERM: operation not permitted, lstat 'C:\Users\ユーザー'` で起動前に停止したため、上記の成功結果は権限付き実行で確認した。

## セルフレビュー

- `service_role`、secret key、回答本文、アクセストークンを通常フローやログへ含めていない。
- `profiles` はRLSを有効・強制し、明示GRANTと所有者policyを持つ。UPDATE policyには `using` と `with check` の両方を置いた。
- 匿名開始は既存の署名検証済みclaimを優先するため、再実行しても匿名サインインを増やさない。
- `requireUser` は未検証のCookieユーザー情報ではなく `getClaims()` のsubjectだけを受け入れる。
- `git diff --check` は成功した。

## 懸念と次の検証

- Docker未導入のため、pgTAPのヘルパー互換性、トリガー、RLSポリシーの実DB挙動は未検証である。
- ホスト済み開発プロジェクトを使う場合も、本番へ直接適用せず、Anonymous Sign-insをDashboardで有効化してからmigrationとDBテストを実行する。

## Fix round 1

### 変更

- `throws_ok` を4引数形式へ修正し、SQLSTATE `42501`、期待メッセージなし、説明文を明確に分離した。これにより説明文を誤って期待エラーメッセージとして比較しない。
- pgTAP helperの利用者作成をemailベースから、`tests.anonymous_users` のテスト名→UUID対応へ変更した。
- 匿名利用者行は `auth.users.is_anonymous = true`、emailなし、`provider = anonymous`、`providers = [anonymous]` のapp metadataを持つ。`auth.identities` へemail identityは作成しない。
- JWT切替helperは `sub`、`role = authenticated`、`is_anonymous = true` を設定する。

### 対象ファイル

- `supabase/tests/database/000_test_helpers.sql`
- `supabase/tests/database/001_rls_foundation.test.sql`
- `.superpowers/sdd/2026-08-13-avatar-matching-production-pilot/task-2-report.md`

### コマンドと結果

- RED確認: `pnpm test:db` を実行したが、sandboxではNode起動前に `EPERM: operation not permitted, lstat 'C:\Users\ユーザー'` で停止した。Docker未導入のため、SQL/pgTAPのRED/GREENはいずれも実DBでは観測できない。
- 静的検証: `git diff --check` は成功した。
- 権限付き `pnpm lint`: 成功、exit 0。
- 権限付き `pnpm typecheck`: 成功、exit 0。
- 権限付き `pnpm test`: 成功、7 file / 13 test。
- 権限付き `pnpm test:db`: `$ supabase test db` 起動後に `LegacyDbConnectError`、`ECONNREFUSED 127.0.0.1:54322`、exit 1。Docker未導入のためSQL/pgTAPは未検証であり、PASSではない。

### セルフレビュー

- `throws_ok` の第3引数を `null` とし、pgTAP 1.3.4で説明付きSQLSTATE検証に必要な4引数契約へ合わせた。
- 匿名利用者のテストデータはemail/identityを作らず、匿名固有フラグとprovider metadata、JWT claimを一貫して持つ。
- `role` は匿名ユーザーにも適用される `authenticated` のままであり、`anon` roleやservice roleを使っていない。
