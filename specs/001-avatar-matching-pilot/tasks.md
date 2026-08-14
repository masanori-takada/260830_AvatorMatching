# Tasks: AIアバター自動マッチング実証パイロット

**Input**: `/specs/001-avatar-matching-pilot/` の仕様・設計成果物

**Tests**: 憲章によりTDD、RLS、E2E、視覚回帰を必須とする。

## Phase 1: Setup

- [X] T001 Next.js 16.3.0と固定依存を `package.json`、`pnpm-lock.yaml`、`tsconfig.json`、`next.config.ts` に構成する
- [X] T002 [P] Vitest、Testing Library、Playwright、axeの設定を `vitest.config.ts`、`playwright.config.ts`、`tests/setup.ts` に作成する
- [X] T003 [P] 環境変数契約を `.env.example` と `src/lib/env.ts` に作成する
- [X] T004 [P] 公開対象を限定する `.gitignore` と `public/app-assets/README.md` を作成し、PDF・GIFを公開しない規則を記載する

## Phase 2: Foundational

- [X] T005 Supabase設定、基礎スキーマ、pgTAP認証ヘルパーを `supabase/config.toml`、`supabase/migrations/202608130001_foundation.sql`、`supabase/tests/database/000_test_helpers.sql` に作成する
- [X] T006 [P] 20問と架空候補を `supabase/migrations/202608130002_interview.sql`、`supabase/migrations/2026081300025_reference_candidate.sql`、`supabase/seed.sql` に定義する
- [X] T007 [P] ブラウザ・サーバー・proxy用クライアントを `src/lib/supabase/client.ts`、`server.ts`、`proxy.ts`、`src/proxy.ts` に作成する
- [X] T008 認証済み利用者を毎回検証するDALを `src/features/identity/server/session.ts` と `src/features/identity/server/actions.ts` に実装する
- [X] T009 [P] 共通Result、エラー分類、秘匿ログを `src/lib/result.ts`、`src/lib/logger.ts`、`src/lib/errors.ts` に実装し `tests/unit/lib/` で検証する
- [X] T010 [P] 既存デモ由来のトークンとAppShellを `src/app/globals.css`、`src/components/app-shell/` に実装し `tests/unit/components/app-shell.test.tsx` で検証する
- [ ] T011 RLS基礎テストを `supabase/tests/database/001_rls_foundation.test.sql` に作成し、T005の認証ヘルパーで匿名利用者間の遮断を確認する

## Phase 3: User Story 1 - 20問のインタビュー (P1)

**Independent Test**: 未開始から20問へ回答し、20回答とアバター要約が保存される。

- [X] T012 [P] [US1] 質問・回答スキーマの失敗テストを `tests/unit/interview/schemas.test.ts` に作成する
- [X] T013 [P] [US1] 回答保存・完了Actionの統合テストを `tests/integration/interview/actions.test.ts` に作成する
- [X] T014 [US1] 質問・回答ドメインとActionを `src/features/interview/domain.ts`、`schemas.ts`、`server/queries.ts`、`server/actions.ts` に実装する
- [X] T015 [US1] 決定論的アバター要約を `src/lib/ai/provider.ts`、`schemas.ts`、`mock-provider.ts` と `src/features/avatar-profile/server/service.ts` に実装する
- [X] T016 [US1] 開始、質問、完了画面を `src/app/(journey)/start/`、`interview/[order]/`、`interview/complete/` と `src/components/interview/` に実装する
- [X] T017 [US1] 20問完了フローを `tests/e2e/interview.spec.ts` に実装し、選択15問・自由記述5問・空白拒否を検証する

## Phase 4: User Story 2 - 会話と相性レポート (P1)

**Independent Test**: 完了回答から処理を開始し、通知、8以上の発言、5軸と引用根拠を表示する。

- [X] T018 [P] [US2] 要約・マッチ出力契約テストを `tests/unit/ai/mock-provider.test.ts`、`tests/contract/ai-profile.test.ts`、`tests/contract/ai-match.test.ts` に作成する
- [X] T019 [P] [US2] マッチ状態と完了RPCのpgTAPを `supabase/tests/database/002_match_processing.test.sql` に作成する
- [X] T020 [US2] match、message、report、dimension、notificationスキーマ、RPC、Realtime publicationを `supabase/migrations/202608130003_matching.sql` に実装する
- [X] T021 [US2] マッチサービスと処理Routeを `src/features/matching/server/` と `src/app/api/match-runs/[id]/process/route.ts` に実装する
- [X] T022 [US2] Realtime＋ポーリング状態表示を `src/features/matching/client/use-match-run.ts` と `src/app/(journey)/matching/page.tsx` に実装する
- [X] T023 [US2] 通知、会話ログ、5軸レポートUIを `src/app/(journey)/notifications/`、`report/`、`src/components/report/` に実装する
- [X] T024 [US2] 会話生成からレポート表示までを `tests/e2e/matching-report.spec.ts` で検証する

## Phase 5: User Story 3 - 承諾・辞退と段階的開示 (P1)

**Independent Test**: 承諾だけが架空プロフィールを返し、未決定・辞退・別利用者では0件になる。

- [ ] T025 [P] [US3] 決定一意性と開示境界のpgTAPを `supabase/tests/database/003_decision_reveal.test.sql` に作成する
- [ ] T026 [P] [US3] Action契約テストを `tests/integration/decision/actions.test.ts` に作成する
- [ ] T027 [US3] decisionと開示RPCを `supabase/migrations/202608130004_decision_reveal.sql` に実装する
- [ ] T028 [US3] 決定Actionと開示queryを `src/features/decision/server/actions.ts`、`queries.ts` に実装する
- [ ] T029 [US3] 確認、開示、辞退画面を `src/components/feedback/decision-dialog.tsx`、`src/app/(journey)/reveal/`、`declined/` に実装する
- [ ] T030 [US3] 承諾・辞退・承諾前漏洩を `tests/e2e/decision-reveal.spec.ts` で検証する

## Phase 6: User Story 4 - 中断・再開・修正 (P2)

**Independent Test**: 7問後に再読込して第8問から再開し、開始前は修正、開始後は拒否される。

- [ ] T031 [P] [US4] draftとrevision競合テストを `tests/unit/interview/draft-store.test.ts`、`tests/integration/interview/revision.test.ts` に作成する
- [ ] T032 [US4] 一時保存と再送を `src/features/interview/client/draft-store.ts`、`use-answer-submit.ts` に実装する
- [ ] T033 [US4] 回答一覧と修正導線を `src/app/(journey)/mypage/page.tsx` と `src/components/interview/answer-list.tsx` に実装する
- [ ] T034 [US4] 再開・修正・開始後ロックを `tests/e2e/interview-resume.spec.ts` で検証する

## Phase 7: User Story 5 - ホームと現在地 (P2)

**Independent Test**: interview、processing、completedの各状態で正しい主操作が表示される。

- [ ] T035 [P] [US5] journey状態導出テストを `tests/unit/home/journey-state.test.ts` に作成する
- [ ] T036 [US5] 状態導出と画面ガードを `src/features/matching/server/journey-state.ts`、`src/app/page.tsx` に実装する
- [ ] T037 [US5] 忠実なホームと下部ナビを `src/app/(journey)/home/page.tsx`、`src/components/home/`、`src/components/app-shell/bottom-nav.tsx` に実装する
- [ ] T038 [US5] 3状態の主操作と直接URLガードを `tests/e2e/home-state.spec.ts` で検証する

## Phase 8: User Story 6 - プライバシー・FAQ・リセット (P3)

**Independent Test**: 説明を閲覧し、確認付きリセットで自分のデータだけが消え第1問へ戻る。

- [ ] T039 [P] [US6] リセット分離のpgTAPを `supabase/tests/database/004_reset.test.sql` に作成する
- [ ] T040 [US6] reset RPCとActionを `supabase/migrations/202608130005_reset.sql`、`src/features/identity/server/reset-action.ts` に実装する
- [ ] T041 [P] [US6] プライバシーとFAQを `src/app/(journey)/privacy/page.tsx`、`faq/page.tsx` に実装する
- [ ] T042 [US6] 設定と確認付きリセットを `src/app/(journey)/settings/page.tsx` と `tests/e2e/reset.spec.ts` に実装する

## Phase 9: Polish & Cross-Cutting

- [ ] T043 [P] axe・キーボード・主要画面2秒以内のE2Eを `tests/e2e/accessibility.spec.ts`、`tests/e2e/performance.spec.ts` に追加する
- [ ] T044 [P] 320px、390px、PC中央表示の視覚回帰を `tests/visual/demo-fidelity.spec.ts` に追加する
- [ ] T045 セキュリティ回帰として全RLS・開示テストを実行し `specs/001-avatar-matching-pilot/quickstart.md` の結果を記録する
- [ ] T046 [P] 起動、Supabase、モック／Bedrock境界、検証方法を `README.md` に記載する
- [ ] T047 lint、typecheck、unit、DB、E2E、visual、buildを順に実行し、全ゲート成功を確認する

## Dependencies

```text
Setup -> Foundational -> US1 -> US2 -> US3
                         |      |
                         +-> US4+-> US5
                                +-> US6
All selected stories -> Polish
```

- US1はFoundation後に独立実装できる。
- US2はUS1の回答と要約を入力にする。
- US3はUS2のcompletedレポートに依存する。
- US4はUS1後、US5はUS1/US2後、US6はFoundation後に並行可能。

## Parallel Examples

- Foundation: T006、T007、T009、T010を別ファイルで並行可能。
- US2: T018とT019を先に並行し、両方を赤にしてからT020〜T023へ進む。
- US3: T025とT026を並行し、DB境界とAction契約を別々に赤にする。
- Polish: T043、T044、T046を並行し、最後にT047で統合する。

## Implementation Strategy

1. T001〜T011で基盤と匿名RLSを完成する。
2. T012〜T017を最小MVPとして20問の保存まで動かす。
3. T018〜T030で事業価値の中心である会話、レポート、決定、開示を完成する。
4. T031〜T042で再開、ホーム、説明、リセットを加える。
5. T043〜T047でアクセシビリティ、視覚忠実性、全品質ゲートを閉じる。

全47タスクはチェックボックス、連番、必要なStoryラベル、具体的なファイルパスを満たす。
