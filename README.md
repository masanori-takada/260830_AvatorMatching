# AIアバターマッチング 実証パイロット

匿名の20問インタビューに答えると、その回答からAIアバターが作られる。アバターは事前登録された架空のデモ候補のアバターと自動で会話し、その会話をもとに5軸の相性レポートを生成する。利用者は会話ログとレポートを読んだうえで「会ってみたい」または「今回は見送る」を選び、承諾した場合に限って相手の（架空の）名前・所属・紹介文が開示される。

ログインや招待コード入力を必須とせず、決定前は匿名性を保ったまま体験を完結できることを検証するための実証パイロットである。会話・要約・相性評価の生成はAIプロバイダー（モックまたはGemini API）が担い、データはホスト型Supabaseに保存される。

## セットアップと起動

### 依存関係のインストール

このリポジトリは pnpm を使うが、PATHに `pnpm` が入っていない環境がある。その場合は Corepack 経由で実行する。

```bash
corepack pnpm install
```

### Node.jsバージョンについて

`package.json` の `engines` は `>=22.0.0` を要求しており、検証環境のNode `v22.16.0` と一致している。以前は `>=24.0.0 <25.0.0` を要求しており実環境（v22系）と食い違っていたが、実態に合わせて修正済み。

### 環境変数

`.env.example` を `.env.local` にコピーし、値を埋める。

```bash
cp .env.example .env.local
```

### 開発サーバーの起動

```bash
corepack pnpm dev
```

## 環境変数一覧

実際の値（URL・APIキーなど）はここには書かない。`.env.local` に以下を設定する。

| 変数名 | 必須 | 意味 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | SupabaseプロジェクトのURL。クライアントバンドルに含まれる。 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 必須 | Supabaseの公開可能キー。クライアントバンドルに含まれる。 |
| `AI_PROVIDER` | 必須 | `mock` / `gemini` / `openai`。会話・要約・相性評価をどの実装で生成するか。 |
| `GEMINI_API_KEY` | `AI_PROVIDER=gemini` のときのみ必須 | Gemini APIキー。サーバー専用（`server-only`によりクライアントバンドルからのimportをビルド時に検出）。 |
| `GEMINI_MODEL` | 任意 | Geminiのモデル名を差し替える場合に指定。未設定時の既定は後述。 |
| `OPENAI_API_KEY` | `AI_PROVIDER=openai` のときのみ必須 | OpenAI APIキー。サーバー専用。 |
| `OPENAI_MODEL` | `AI_PROVIDER=openai` のときのみ必須 | OpenAIのモデルID。**既定値は用意していない**（コード側でモデルIDを推測しない設計）。未設定のまま `AI_PROVIDER=openai` にすると、起動時にエラーで失敗する。 |
| `ACCESS_CODE` | 任意 | 限定公開用の合言葉ゲート（`src/proxy.ts`）で使う合言葉。**未設定の場合、ゲートは無効になり誰でもアプリへアクセスできる。** 本番で限定公開にする場合は必ず設定すること。サーバー専用（`src/lib/env/server.ts`）で、クライアントバンドルには含まれない。合言葉はクッキーへそのまま保存せず、`node:crypto`のHMACで導出した値だけを保存し、比較はタイミング安全（`timingSafeEqual`）に行う。 |

## Supabase

ホスト型（クラウド）のSupabaseプロジェクトを使用する。ローカルDockerスタックは前提にしていない。

- ログインとプロジェクトのリンクは対話的な認証が必要なため、利用者自身が事前に実行する。
  ```bash
  corepack pnpm exec supabase login
  corepack pnpm exec supabase link
  ```
- マイグレーションの反映:
  ```bash
  corepack pnpm exec supabase db push
  ```
- マイグレーションSQLは `supabase/migrations/` に、DBテスト（pgTAP）は `supabase/tests/database/` にある。

## モック／Gemini の境界

会話・要約・相性評価の生成は `src/lib/ai/provider.ts` の `getAiProvider()` が `AI_PROVIDER` に応じて切り替える。

- **`AI_PROVIDER=mock`**: `src/lib/ai/mock-provider.ts` を使う。外部通信を行わず、決定的な出力を返す。E2Eテストはこちらで実行する。
- **`AI_PROVIDER=gemini`**: `src/lib/ai/gemini-provider.ts` の `GeminiAiProvider` が `@google/genai` 経由でGemini APIを呼び出す。
- **`AI_PROVIDER=openai`**: `src/lib/ai/openai-provider.ts` の `OpenAiAiProvider` が、OpenAIのChat Completions API（structured outputs）を `fetch` で直接呼び出す（`openai` パッケージへの依存は追加していない）。
- **`GEMINI_API_KEY` が未設定のまま `AI_PROVIDER=gemini` にすると、モックへは自動フォールバックせず、その場でエラーを投げて起動・実行を失敗させる。** 同様に、**`OPENAI_API_KEY` が未設定のまま `AI_PROVIDER=openai` にした場合、および `OPENAI_MODEL` が未設定のまま `AI_PROVIDER=openai` にした場合も、モックへは自動フォールバックせずエラーで失敗する。** これは「気づかないままモックの偽の結果を本物の生成結果だと誤認しない」ための意図的な設計であり、`src/lib/ai/provider.ts` に明記されている。`OPENAI_MODEL` に既定値を用意していないのは、利用するモデルIDが未確定の時点でコード側が推測しないための判断。
- **既定モデルとタイムアウト**:
  - Gemini既定モデル（`src/lib/ai/gemini-provider.ts`）: `gemini-3.5-flash-lite`（`GEMINI_MODEL` 環境変数で差し替え可能）。OpenAIはモデルIDの既定値を持たず、`OPENAI_MODEL` で必ず指定する。
  - 生成1回あたりのタイムアウト: `25_000` ミリ秒（25秒。会話の発言数を24〜36発言に広げたことに伴い、実測（generateMatch 9.2〜10.1秒）に基づいて20秒から引き上げた）。
  - 契約（Zodスキーマ）を満たさない出力は1回だけ作り直し、それでも満たさない場合は `INVALID_OUTPUT` として失敗させ、不正な会話・レポートを保存しない。

### プライバシー境界

AIへ渡す前に `src/lib/ai/privacy-provider.ts` の `PrivacySafeAiProvider` が自由記述回答をサニタイズする（`GeminiAiProvider` / `MockAiProvider` は必ずこのラッパー越しに呼ばれる）。

- 自由記述の回答から、氏名・会社名・所属などの明示的な識別情報（「名前は◯◯」「◯◯と申します」「◯◯です」形式の氏名等）を `[非公開]` に置き換えてから生成器へ渡す（`redactSelfDisclosedIdentity`）。趣味・価値観などの内容そのものは残す。
- メールアドレス・URL・郵便番号・電話番号形式の文字列、および固定の架空デモ候補名（`redactPotentialPii` が定義するパターン）も除去対象。
- 生成後の出力に対しても、除去前の自由記述回答から抽出した識別情報の断片が含まれていないかを再チェックし（`assertNoPrivateAnswerLeak`）、含まれていた場合はエラーとして出力を破棄する。入口（生成前のサニタイズ）と出口（生成後の漏洩検査）で同じパターン集合を使うことで、片方だけを緩めた結果の漏洩・誤検知を防いでいる。

## 検証方法

### 実行できるゲート

`package.json` の `scripts` にあるコマンドのみを記載する。

| コマンド | 内容 |
| --- | --- |
| `corepack pnpm run typecheck` | `tsc --noEmit` |
| `corepack pnpm run lint` | `eslint .` |
| `corepack pnpm run test` | `vitest run`（ユニット・統合テスト） |
| `corepack pnpm run build` | `next build` |
| `corepack pnpm run test:e2e` | `playwright test --grep-invert @visual`（`@visual`タグ以外のE2E） |
| `corepack pnpm run test:visual` | `playwright test --grep @visual`（視覚回帰） |

E2E・視覚回帰は `AI_PROVIDER=mock` で実行すること。外部APIへ実際に接続せず、決定的な結果でテストできる。

合言葉ゲートを含めてE2E・視覚回帰を実行するには、テストサーバーに `ACCESS_CODE` を設定して起動する。値は `tests/e2e/support/access-gate.ts` の `ACCESS_CODE` 定数が唯一の定義元で、サーバーへ渡す値もこれと一致させる。ゲート通過処理も同ファイルにまとまっており、各specはそこから `test` / `expect` をimportするだけでよい。

```bash
AI_PROVIDER=mock ACCESS_CODE="e2e-test-passphrase-not-the-real-one" node node_modules/next/dist/bin/next start -p 3200
```

`.claude/launch.json` の `avatar-matching-e2e` にも同じ `env` を書いてあるが、**起動ツール経由では `env` が渡らないことがある**。その場合ゲートが無効な状態で起動し、`tests/e2e/access-gate.spec.ts` が「ゲート画面が出ない」ため失敗する。ゲートが効いているかは `curl -i http://localhost:3200/start` が `/access-gate` へリダイレクトするかで確認できる。上のコマンドで直接起動すれば確実。

### 実行できないゲート

- **pgTAP（`corepack pnpm run test:db` = `supabase test db`）は実行できない。** 検証環境にDockerが導入されていないため。`supabase/tests/database/` にSQLは書かれているが、未実行のままである。
- 代わりに `tests/unit/config/*-db-contract.test.ts`（`vitest run` の対象に含まれる）が、マイグレーションSQLの内容を静的に検証している（テーブル定義・制約・RLSポリシーの記述などをソースコードとして検査するもので、実際にDBへ適用して確認するものではない）。

### 既知の制約: Supabase匿名サインインのレート上限

Supabaseの匿名サインインにはレート上限がある。E2Eフルスイート（`test:e2e` / `test:visual`）を短時間に何度も連続実行すると、`anonymous_session_failed` エラーで全テストが失敗することがある。これはアプリケーションコードの不具合ではなく、Supabase側のレート制限によるものなので、時間を置いて再実行する。

## プロジェクト構成

| ディレクトリ | 役割 |
| --- | --- |
| `src/app/` | Next.js App Router。ページ・APIルート（`src/app/(journey)`、`src/app/api`）。 |
| `src/features/` | 機能単位のドメインロジック・UI（`interview`、`matching`、`decision`、`avatar-profile`、`identity`、`notifications`）。 |
| `src/lib/ai/` | AIプロバイダー抽象化。`provider.ts`（切り替え）、`mock-provider.ts`、`gemini-provider.ts`、`openai-provider.ts`、`generation.ts`（タイムアウト・リトライ共通処理）、`prompts.ts`（プロンプト文面）、`privacy-provider.ts`（プライバシー境界）、`schemas.ts`（出力契約・PII検査）。 |
| `src/lib/env/` | 環境変数の検証。`public.ts`（クライアントへ露出してよい変数）、`server.ts`（サーバー専用変数）。 |
| `src/lib/supabase/` | Supabaseクライアント初期化（`client.ts`、`server.ts`、`proxy.ts`）。 |
| `src/components/` | 共有UIコンポーネント。 |
| `supabase/migrations/` | データベースマイグレーションSQL。 |
| `supabase/tests/database/` | pgTAPテスト（現状未実行。上記「検証方法」参照）。 |
| `tests/unit/` | ユニットテスト（`vitest`）。DB契約の静的検証を含む。 |
| `tests/integration/`, `tests/contract/` | 統合・契約テスト（`vitest`）。 |
| `tests/e2e/`, `tests/visual/` | E2E・視覚回帰テスト（`playwright`）。 |
| `specs/001-avatar-matching-pilot/` | 仕様書・実装計画・タスク一覧。 |
