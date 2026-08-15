# Quickstart Validation Guide

## Prerequisites

- Node.js 22系（`package.json` の `engines` は `>=22.0.0` で実環境と一致。詳細はREADME参照）
- Supabase CLI は導入済み。Docker Desktopは未導入（2026-08-15時点）。
- Supabase project URL and publishable key（ホスト型クラウドプロジェクト）

`pnpm` はPATHに無いため `corepack pnpm <cmd>` を使う。詳細・環境変数一覧・AIプロバイダーの切り替えは `README.md` を参照。

## Install

```bash
corepack pnpm install
cp .env.example .env.local
```

`.env.local` に設定する変数の一覧は `README.md` の「環境変数一覧」を参照（実値はここに書かない）。

`SUPABASE_SERVICE_ROLE_KEY` は初期版の通常フローに不要であり、ブラウザ公開変数へ設定しない。

`ACCESS_CODE`（限定公開の合言葉ゲート）は未設定のままでよい。空にしておけばゲートは無効になり、
ローカル開発・下記のAutomated gatesはこれまで通りゲート無しで通る。合言葉ゲートを含めて
E2E・視覚回帰を検証したい場合だけ、`.claude/launch.json` の `avatar-matching-e2e` 設定
（port 3200）を使い、同じ `ACCESS_CODE` をPlaywright実行プロセス側にも設定して
`tests/e2e/access-gate.spec.ts` を含むフルスイートを実行する。

## Supabase

ホスト型（クラウド）のSupabaseプロジェクトへ直接つなぐ。ローカルSupabase起動・pgTAPはDocker未導入のため実行できない。

- `supabase login` / `supabase link` は対話的認証が必要なため、利用者自身が事前に実行する。
- マイグレーション反映:
  ```bash
  corepack pnpm exec supabase db push
  ```

本番プロジェクトへ直接適用しない。DashboardでAnonymous Sign-insを有効化する。

## Run

```bash
corepack pnpm dev
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

```bash
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run test:db
corepack pnpm run test:e2e
corepack pnpm run test:visual
corepack pnpm run build
```

Dockerがない環境では `test:db`（pgTAP）は実行不能。完了報告ではスキップを成功として扱わない。
実行できるゲート・実行できないゲートの詳細は `README.md` の「検証方法」を参照。

## Expected outcomes

- 単体・コンポーネント・E2E・視覚テストが全件成功する。
- RLSテストで他匿名利用者の取得・変更が0件になる。
- 開示RPCはaccept後だけ1件を返す。
- 320px、390px、PC中央表示のスクリーンショットに横欠けがない。
- `AI_PROVIDER=mock` の同じ回答から同じ会話とスコアが得られる。

## 検証結果（2026-08-15実施）

### 実行できたもの

| ゲート | 結果 |
| --- | --- |
| typecheck (`tsc --noEmit`) | 成功 |
| lint (`eslint .`) | 成功 |
| 単体テスト (`vitest run`) | 44ファイル / 223件 すべて成功 |
| 本番ビルド (`next build`) | 成功 |
| E2E（`@visual` 除く、フルスイート） | 15件中 14件成功 / 1件失敗 |
| アクセシビリティE2E | 6件すべて成功 |
| 視覚回帰（`@visual`） | 基準画像を生成済み。2件中1件は再実行でも一致を確認 |

E2Eの失敗1件は `tests/e2e/reset.spec.ts` の
「回答済みの状態でリセットすると確認のうえ開始画面へ戻り、以前の回答は残らない(FR-035)」。
原因はリセット用マイグレーション `202608150003_reset.sql` が本番DBへ未適用であること。
コードの不具合ではない。適用後に再実行が必要。

### セキュリティ・開示に関する検証（SC-006 / SC-007）

- **SC-006（承諾前および辞退後に候補者の開示プロフィールが漏れないこと）**:
  `tests/e2e/decision-reveal.spec.ts` の2件が成功。
  「承諾前の直URLでは漏洩せず明示承諾後だけ架空プロフィールを開示する」
  「辞退後も候補者情報を開示しない」の両方で、架空プロフィールの実データ
  （氏名・会社名・部署名）が画面に現れないことを確認済み。
  また `tests/e2e/matching-report.spec.ts` でも、承諾前のレポート画面に同データが
  現れないことを確認済み。検出件数0件。
- **SC-007（他利用者のデータへアクセスできないこと）**: 未実施。
  この検証は pgTAP（`supabase/tests/database/`）が担っており、Docker未導入のため
  一度も実行できていない。これは積み残しの検証負債である。

### 実行できないもの

| ゲート | 状態 |
| --- | --- |
| pgTAP (`test:db`) | 未実行。Docker未導入。5つのスイートが書かれているが一度も走っていない |

pgTAPの代わりに `tests/unit/config/*-db-contract.test.ts` がSQLファイルを静的に読んで
契約（owner分離・最小権限・plan数の整合など）を検証している。ただし静的検査であり、
実際にDBで動かした検証の代替にはならない。

### 既知の制約: Supabase匿名サインインのレート上限

E2Eは1テストにつき匿名ユーザーを1人作る。テスト数が増えた結果、フルスイート1回で
25人以上を作るようになり、短時間に繰り返し実行すると上限に達して
`anonymous_session_failed` で全テストが失敗する。これはコードの不具合ではない。
本物の不具合と見分けがつきにくいため、失敗時はまずサーバーログの
`anonymous_session_failed` の有無を確認すること。
対処は Supabase ダッシュボードの Authentication → Rate Limits で上限を引き上げること。

### 未検証で残っているもの

- `tests/e2e/performance.spec.ts`（主要画面2秒以内）: レート上限のため未検証。
  上限に達する前の単発計測では全画面が2秒以内（最大は `/mypage` の542ms）だったが、
  再現確認ができていないため確定値ではない。
- 視覚回帰の「承諾フローの主要画面」テスト: 基準画像生成後の再実行がレート上限で未完了。
