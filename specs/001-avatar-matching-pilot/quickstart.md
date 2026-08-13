# Quickstart Validation Guide

## Prerequisites

- Node.js 24 LTS
- pnpm 11.19.0 or compatible 11.x
- Supabase project URL and publishable key
- Local DB/RLS testing only: Docker Desktop and Supabase CLI 2.114.0

このPCではNodeとpnpmは利用可能だが、2026-08-13時点でDockerとSupabase CLIは未導入。

## Install

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

`.env.local` に次を設定する。

```text
NEXT_PUBLIC_SUPABASE_URL=<development project URL>
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<development publishable key>
AI_PROVIDER=mock
```

`SUPABASE_SERVICE_ROLE_KEY` は初期版の通常フローに不要であり、ブラウザ公開変数へ設定しない。

## Supabase

### Local option

Docker Desktop導入後:

```powershell
pnpm exec supabase start
pnpm exec supabase db reset
pnpm exec supabase test db
```

### Hosted development option

開発専用Supabaseプロジェクトをリンクした後:

```powershell
pnpm exec supabase link --project-ref <development-project-ref>
pnpm exec supabase db push
```

本番プロジェクトへ直接適用しない。DashboardでAnonymous Sign-insを有効化する。

## Run

```powershell
pnpm dev
```

`http://localhost:3000` を開き、次を確認する。

1. 個人情報入力なしで開始できる。
2. 7問回答後に再読込し、第8問から再開する。
3. 20問完了後、回答を反映した要約が表示される。
4. マッチ処理がqueued、processing、completedと進む。
5. 通知から会話ログと5軸レポートを開ける。
6. 承諾前に架空名と所属がどのレスポンスにも含まれない。
7. 承諾すると開示され、辞退では開示されない。
8. リセット後に同じ匿名セッションで第1問へ戻る。

## Automated gates

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm test:visual
pnpm build
```

Dockerがない環境では `test:db` を実行不能として明示し、ホスト済み開発プロジェクトで同等のRLS
統合テストを実行する。完了報告ではスキップを成功として扱わない。

## Expected outcomes

- 単体・コンポーネント・E2E・視覚テストが全件成功する。
- RLSテストで他匿名利用者の取得・変更が0件になる。
- 開示RPCはaccept後だけ1件を返す。
- 320px、390px、PC中央表示のスクリーンショットに横欠けがない。
- `AI_PROVIDER=mock` の同じ回答から同じ会話とスコアが得られる。
