# Phase 0 Research: AIアバター自動マッチング実証パイロット

## 1. Next.jsとプロジェクト配置

**Decision**: リポジトリ直下へNext.js 16.3.0 App Routerアプリを置き、ソースは `src/` 配下にする。

**Rationale**: 単一アプリでServer Components、Server Actions、Route Handlersを利用でき、既存PoCの
ルートファイルも参照資料として保持できる。Server Actionsは公開エンドポイントと同様に毎回認可を
検証し、データアクセス層を通す。

**Alternatives considered**:
- `web/` サブディレクトリ: 参照資料との分離は明確だが、実行・デプロイ手順が一段増える。
- Pages Router: 新規実装で選ぶ理由がなく、サーバー／クライアント境界が弱い。

## 2. スタイリング

**Decision**: Tailwindを追加せず、`globals.css` のデザイントークンと機能単位のCSS Modulesを使う。

**Rationale**: 既存PoCのCSS値、余白、色、カード形状を直接移植しやすく、依存を増やさない。

**Alternatives considered**:
- Tailwind CSS: 実装速度は高いが、既存デモ忠実性のための任意値が増え、今回の縦切りには不要。
- CSS-in-JS: Server Componentsとの境界と実行時依存が増える。

## 3. 匿名セッション

**Decision**: Supabase Anonymous Sign-insを有効化し、`@supabase/ssr` のCookieセッションを使う。
`src/proxy.ts` でトークンを更新し、未セッションの開始操作だけが `signInAnonymously()` を実行する。

**Rationale**: 利用者へ認証UIを見せず、一意の `auth.uid()` をRLSへ利用できる。将来は匿名ユーザーを
正式認証へリンクし、所有者IDを保ったまま移行できる。

**Alternatives considered**:
- 端末UUIDのみ: DBが署名済み利用者を識別できず、RLSの根拠にならない。
- service role経由の独自セッション: 権限境界と実装量が増える。

## 4. RLSと段階的開示

**Decision**: 全所有テーブルで `auth.uid() = owner_id` を強制する。`candidate_reveals` は直接SELECTを
許可せず、`get_candidate_reveal(match_run_id)` が所有者と承諾済み決定を確認した場合だけ返す。

**Rationale**: 開示条件を画面やAPIだけでなくDB境界に固定できる。匿名利用者間の隔離も同じ原則で
一貫して検証できる。

**Alternatives considered**:
- Server Actionだけで開示制御: 実装漏れや別経路からの取得を防げない。
- service roleで全読み取り: 通常フローに過剰権限が入り、憲章へ反する。

## 5. モックAI処理

**Decision**: `AiProvider` をZodで検証する型付き契約とし、`generateProfile()` と
`generateMatch()` を分離する。初期版は入力のハッシュと回答カテゴリから決定論的に結果を作る
`MockAiProvider` を使う。

**Rationale**: 同じ回答から同じ結果が得られ、E2Eと視覚回帰が安定する。Bedrock導入時も
プロバイダーだけを交換できる。要約確認時に会話や評価を先行生成しないため、Bedrock移行後も
不要な推論コストと未確定データを発生させない。

**Alternatives considered**:
- 完全固定JSON: 回答内容を3箇所以上反映する要件を満たさず、体験が不自然。
- 初回からBedrock: 資格情報、費用、モデル出力揺れが動作確認を遅らせる。

## 6. 処理状態とトランザクション

**Decision**: 開始操作で `queued` を作り、クライアントが所有者セッション付き処理Route Handlerを
1回呼ぶ。処理側は `processing` を獲得し、生成後に `complete_match_run` RPCで会話、レポート、
5軸、通知、`completed` を同一トランザクションで確定する。

**Rationale**: サーバーレス環境でレスポンス後のバックグラウンド処理へ依存せず、処理中表示、失敗、
再試行、冪等性を検証できる。

**Alternatives considered**:
- `setTimeout` のバックグラウンド処理: サーバーレスでは実行継続を保証できない。
- 外部キュー: 本番拡張には有効だが、デモ候補1人の初期版には過剰。

## 7. Realtimeと復旧

**Decision**: `match_runs` と `notifications` の所有者行だけをRealtime購読する。購読不能時はページ
再検証と2秒間隔、最大30秒のポーリングへ切り替える。未送信回答は利用者IDと質問コードをキーに
ブラウザへ一時保存する。

`match_runs` と `notifications` はマイグレーションで `supabase_realtime` publicationへ明示的に追加し、
各テーブルのRLSを通過した所有者行だけを購読する。

**Rationale**: 通常は即時更新しつつ、Realtime障害や通信断でも無限待機と入力消失を防ぐ。

**Alternatives considered**:
- Realtimeのみ: 接続失敗時の復旧がない。
- ポーリングのみ: 実装は単純だがSupabase Realtimeを使う憲章と体験の即時性を満たしにくい。

## 8. テスト構成

**Decision**: Vitest + Testing Libraryで単体／コンポーネント、pgTAPでRLS／RPC、PlaywrightでE2Eと
スクリーンショット、axe-coreでアクセシビリティを検証する。

**Rationale**: ドメイン契約、DB権限、実ブラウザ体験、視覚忠実性を別々の失敗として特定できる。

**Alternatives considered**:
- Jest: 利用可能だが、ESMとTypeScript中心の新規構成ではVitestが軽量。
- E2Eだけ: RLSの網羅と高速な失敗局所化が不足する。

## 9. ローカルSupabase環境

**Decision**: Supabase CLI 2.114.0を開発依存または `pnpm exec supabase` で固定し、Docker Desktopが
ある環境では `supabase start` とpgTAPを実行する。Dockerを使えない環境ではホスト済み開発
プロジェクトへマイグレーションを適用する。

**Rationale**: このPCには現在DockerとSupabase CLIがないため、計画が環境依存で停止しないようにする。

**Alternatives considered**:
- Dockerを実装開始条件にする: UIと単体テストまで不必要に停止する。
- ホスト済み環境だけ: RLSテストの反復性と破棄可能性が下がる。

## 10. 依存バージョン

**Decision**: 2026-08-13時点の安定版として、Next.js 16.3.0、React 19.2.8、Supabase JS 2.112.3、
Supabase SSR 0.12.4、Zod 4.4.3、Vitest 4.1.10、Playwright 1.62.1を使用する。TypeScriptはNext.jsとの
実績を優先して5.9.3へ固定し、7系への更新は別変更とする。

**Rationale**: 再現可能な計画とし、実装中の暗黙のメジャー更新を防ぐ。

**Alternatives considered**:
- 全パッケージを `latest`: 再現性がなく、レビュー中に動作が変わる。
- TypeScript 7.0.2: 最新だが、今回の基盤作成と同時に互換性リスクを持ち込まない。
