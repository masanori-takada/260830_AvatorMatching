# AIアバター自動マッチング実証パイロット Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存デモに忠実なUIで、匿名開始から20問、モック会話、5軸レポート、承諾後開示までを実データ保存付きで動かす。

**Architecture:** Next.js App RouterのServer Componentsを表示の基本とし、Server Actionsと所有者検証済みDALでSupabaseへ更新する。全利用者データをRLSで分離し、会話生成は型付き `AiProvider` の決定論的モック、複数テーブル確定と段階的開示は限定RPCで原子的に行う。

**Tech Stack:** Node.js 24、TypeScript 5.9.3、Next.js 16.3.0、React 19.2.8、Supabase JS 2.112.3、Supabase SSR 0.12.4、Zod 4.4.3、Vitest 4.1.10、Playwright 1.62.1、pgTAP

## Global Constraints

- ログイン、メール、電話番号、招待コードの入力なしで体験を開始する。
- 固定20問は選択式15問、自由記述5問で、自由記述は1〜500文字とする。
- 利用者回答を会話の少なくとも3箇所へ意味を保って反映する。
- 相性評価は会話の弾み、価値観、ユーモア、相互関心、不一致の重大度の5軸を0〜100で示す。
- 承諾前および辞退後は候補名、所属、紹介文を一切返さない。
- 他匿名利用者の回答、会話、評価、決定、通知へのアクセスを0件にする。
- 既存デモの配色、情報階層、カード構成、主要な遷移順を維持する。
- 320px以上、キーボード操作、可視フォーカス、reduced-motionへ対応する。
- 回答本文、秘密値、開示情報をログへ出さない。
- `AI_PROVIDER=mock` を初期版の唯一の有効値とし、本番で暗黙にモックへフォールバックしない。
- 既存の `index.html`、`app.js`、`style.css`、PDF、PNG、GIFを削除・上書きしない。

---

### Task 1: Next.jsとテスト基盤

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`
- Create: `vitest.config.ts`, `playwright.config.ts`, `tests/setup.ts`
- Create: `.env.example`, `src/lib/env.ts`, `src/app/layout.tsx`, `src/app/globals.css`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `env` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AI_PROVIDER`
- Produces scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`, `test:visual`

- [ ] **Step 1: 環境変数の失敗テストを書く**

```ts
// tests/unit/lib/env.test.ts
import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("未対応AI providerを拒否する", () => {
    expect(() => parseEnv({ AI_PROVIDER: "automatic" })).toThrow("AI_PROVIDER");
  });
});
```

- [ ] **Step 2: テストを実行し、モジュール未定義で失敗することを確認する**

Run: `pnpm vitest run tests/unit/lib/env.test.ts`
Expected: FAIL with `Cannot find module '@/lib/env'`.

- [ ] **Step 3: 固定依存、scripts、設定、環境変数スキーマを作る**

```ts
// src/lib/env.ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  AI_PROVIDER: z.literal("mock"),
});

export const parseEnv = (value: unknown) => schema.parse(value);
export const env = parseEnv(process.env);
```

- [ ] **Step 4: 単体テスト、型検査、Lintを通す**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all PASS.

- [ ] **Step 5: コミットする**

```powershell
git add package.json pnpm-lock.yaml tsconfig.json next.config.ts eslint.config.mjs vitest.config.ts playwright.config.ts tests/setup.ts .env.example .gitignore src/lib/env.ts src/app
git commit -m "chore: scaffold next app and test tooling"
```

### Task 2: Supabase匿名セッションとRLS基盤

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/202608130001_foundation.sql`, `supabase/tests/database/000_test_helpers.sql`
- Create: `supabase/tests/database/001_rls_foundation.test.sql`
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`, `src/proxy.ts`
- Create: `src/features/identity/server/session.ts`, `src/features/identity/server/actions.ts`

**Interfaces:**
- Produces: `requireUser(): Promise<{ userId: string }>`
- Produces: `startAnonymousJourney(): Promise<ActionResult<{ nextPath: string }>>`
- Consumes: `env` from Task 1

- [ ] **Step 1: 2匿名利用者の分離を検証するpgTAPを書く**

```sql
-- supabase/tests/database/001_rls_foundation.test.sql
begin;
select plan(2);
select tests.create_supabase_user('user_a');
select tests.create_supabase_user('user_b');
select tests.authenticate_as('user_a');
insert into public.profiles(id) values (tests.get_supabase_uid('user_a')) on conflict do nothing;
select tests.authenticate_as('user_b');
select is((select count(*) from public.profiles), 1::bigint, '自分のprofileだけ見える');
select throws_ok($$delete from public.profiles where id = tests.get_supabase_uid('user_a')$$, '42501');
select * from finish();
rollback;
```

- [ ] **Step 2: DBテストを赤にする**

Run: `pnpm exec supabase test db`
Expected: FAIL because `profiles` and policies do not exist. Dockerが未導入なら、実行不能を記録してホスト済み開発DBの統合テストを先に使う。

- [ ] **Step 3: pgTAP用のJWT切替ヘルパーを作り、profiles、作成トリガー、RLS、匿名認証設定を実装する**

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
```

- [ ] **Step 4: SSRクライアント、proxy、セッションDAL、開始Actionを実装する**

```ts
// src/features/identity/server/session.ts
export async function requireUser(): Promise<{ userId: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string") throw new UnauthenticatedError();
  return { userId };
}
```

- [ ] **Step 5: RLSとセッションテストを通す**

Run: `pnpm test && pnpm test:db`
Expected: own row visible, foreign row hidden, anonymous start idempotent.

- [ ] **Step 6: コミットする**

```powershell
git add supabase src/lib/supabase src/features/identity src/proxy.ts tests
git commit -m "feat: add anonymous sessions and row security"
```

### Task 3: 既存デモ忠実なAppShell

**Files:**
- Create: `src/components/app-shell/app-shell.tsx`, `app-shell.module.css`, `bottom-nav.tsx`, `status-bar.tsx`
- Create: `src/components/feedback/action-error.tsx`, `loading-overlay.tsx`
- Create: `tests/unit/components/app-shell.test.tsx`, `tests/visual/app-shell.spec.ts`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `AppShell({ children, activeTab, header, showNavigation })`
- Produces CSS tokens: `--color-wine`, `--color-pink-soft`, `--color-text`, `--phone-max-width: 390px`

- [ ] **Step 1: シェル構造とナビゲーションの失敗テストを書く**

```tsx
it("登録後の4タブと現在タブを示す", () => {
  render(<AppShell activeTab="home" showNavigation>本文</AppShell>);
  expect(screen.getByRole("navigation", { name: "メインナビゲーション" })).toBeVisible();
  expect(screen.getByRole("link", { name: "ホーム" })).toHaveAttribute("aria-current", "page");
});
```

- [ ] **Step 2: テストを赤にする**

Run: `pnpm vitest run tests/unit/components/app-shell.test.tsx`
Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 3: 既存 `style.css` の色・半径・余白をトークン化し、シェルを実装する**

```tsx
export type AppTab = "home" | "mypage" | "notifications" | "settings";
export function AppShell(props: {
  children: React.ReactNode;
  activeTab?: AppTab;
  showNavigation?: boolean;
}) { /* セマンティックなmainとnavを返す */ }
```

- [ ] **Step 4: 320pxとPC中央表示のスクリーンショットを生成する**

Run: `pnpm playwright test tests/visual/app-shell.spec.ts --update-snapshots`
Expected: phone surface has no horizontal overflow at 320px and maxes at 390px on desktop.

- [ ] **Step 5: コミットする**

```powershell
git add src/components src/app/globals.css tests/unit/components tests/visual
git commit -m "feat: recreate demo app shell"
```

### Task 4: 固定20問と回答保存

**Files:**
- Create: `supabase/migrations/202608130002_interview.sql`, `supabase/seed.sql`
- Create: `src/features/interview/domain.ts`, `schemas.ts`, `server/queries.ts`, `server/actions.ts`
- Create: `src/components/interview/question-card.tsx`, `choice-answer.tsx`, `text-answer.tsx`, `progress.tsx`
- Create: `src/app/(journey)/start/page.tsx`, `src/app/(journey)/interview/[order]/page.tsx`
- Test: `tests/unit/interview/schemas.test.ts`, `tests/integration/interview/actions.test.ts`, `tests/e2e/interview.spec.ts`

**Interfaces:**
- Produces: `saveInterviewAnswer(input: SaveInterviewAnswerInput): Promise<ActionResult<SaveInterviewAnswerOutput>>`
- Produces: `getInterviewState(userId): Promise<{ questions; answers; answeredCount; locked }>`
- Consumes: `requireUser()` from Task 2 and `AppShell` from Task 3

- [ ] **Step 1: 15選択・5自由記述と入力制約の失敗テストを書く**

```ts
expect(questions).toHaveLength(20);
expect(questions.filter((q) => q.kind === "choice")).toHaveLength(15);
expect(questions.filter((q) => q.kind === "free_text")).toHaveLength(5);
expect(() => parseAnswer(q20, " ")).toThrow();
expect(parseAnswer(q20, "大切にしたいこと")).toBe("大切にしたいこと");
```

- [ ] **Step 2: 単体・統合テストを赤にする**

Run: `pnpm vitest run tests/unit/interview tests/integration/interview`
Expected: FAIL for missing question and action modules.

- [ ] **Step 3: 仕様書の20問をSQLへ一字ずつ転記し、回答テーブルと更新ロックを実装する**

```sql
create unique index interview_answers_owner_question
on public.interview_answers(owner_id, question_code);
```

- [ ] **Step 4: Zod検証、revision付きupsert、1画面1問UIを実装する**

```ts
export type SaveInterviewAnswerInput = {
  questionCode: `q${string}`;
  answer: string;
  expectedRevision: number | null;
};
```

- [ ] **Step 5: 20問E2Eを通す**

Run: `pnpm playwright test tests/e2e/interview.spec.ts`
Expected: progress reaches `20 / 20`, blank free text is rejected, 20 rows persist.

- [ ] **Step 6: コミットする**

```powershell
git add supabase src/features/interview src/components/interview "src/app/(journey)" tests
git commit -m "feat: add twenty-question interview"
```

### Task 5: 分離したAiProvider契約とアバター要約

**Files:**
- Create: `src/lib/ai/types.ts`, `schemas.ts`, `provider.ts`, `mock-provider.ts`, `index.ts`
- Create: `src/features/avatar-profile/server/service.ts`
- Create: `src/app/(journey)/interview/complete/page.tsx`
- Test: `tests/unit/ai/mock-provider.test.ts`, `tests/contract/ai-profile.test.ts`, `tests/contract/ai-match.test.ts`

**Interfaces:**
- Produces: `AiProvider.generateProfile(input: ProfileInput): Promise<AvatarProfileOutput>`
- Produces: `AiProvider.generateMatch(input: MatchInput): Promise<MatchOutput>`
- Produces: `completeInterview(): Promise<ActionResult<{ summary: string; sourceRevision: number }>>`
- Consumes: JSON shapes from `contracts/ai-profile.schema.json` and `contracts/ai-match.schema.json`

- [ ] **Step 1: 決定性、3回答反映、5軸一意性の失敗テストを書く**

```ts
const firstProfile = await provider.generateProfile(profileFixture);
const secondProfile = await provider.generateProfile(profileFixture);
expect(firstProfile).toEqual(secondProfile);
const match = await provider.generateMatch(matchFixture);
expect(new Set(match.messages.flatMap((m) => m.answerRefs)).size).toBeGreaterThanOrEqual(3);
expect(new Set(match.report.dimensions.map((d) => d.axis)).size).toBe(5);
```

- [ ] **Step 2: テストを赤にする**

Run: `pnpm vitest run tests/unit/ai tests/contract`
Expected: FAIL because provider is missing.

- [ ] **Step 3: Zod出力契約と `MockAiProvider` を実装する**

```ts
export interface AiProvider {
  generateProfile(input: ProfileInput): Promise<AvatarProfileOutput>;
  generateMatch(input: MatchInput): Promise<MatchOutput>;
}

export function getAiProvider(name: "mock"): AiProvider {
  return new MockAiProvider();
}
```

- [ ] **Step 4: 20回答のrevision合計を持つ要約upsertと完了画面を実装する**

Run: `pnpm vitest run tests/unit/ai tests/contract`
Expected: all PASS and output contains no `fullName`, `company`, or `department` keys.

- [ ] **Step 5: コミットする**

```powershell
git add src/lib/ai src/features/avatar-profile "src/app/(journey)/interview/complete" tests/unit/ai tests/contract
git commit -m "feat: add deterministic avatar provider"
```

### Task 6: マッチ処理と原子的レポート確定

**Files:**
- Create: `supabase/migrations/202608130003_matching.sql`
- Create: `supabase/tests/database/002_match_processing.test.sql`
- Create: `src/features/matching/server/queries.ts`, `actions.ts`, `process.ts`
- Create: `src/app/api/match-runs/[id]/process/route.ts`
- Test: `tests/integration/matching/process.test.ts`

**Interfaces:**
- Produces: `startMatch(): Promise<ActionResult<{ matchRunId: string; status: "queued" }>>`
- Produces: `processOwnedMatch(matchRunId: string): Promise<"completed">`
- Consumes: `AiProvider.generateMatch()` and DB RPC contracts

- [ ] **Step 1: 状態遷移、冪等性、部分公開防止のpgTAPを書く**

```sql
select is(public.claim_match_run(:run_id), 'processing'::public.match_status);
select throws_ok($$select public.complete_match_run(:run_id, '{}'::jsonb)$$, 'INVALID_OUTPUT');
select is((select count(*) from public.compatibility_reports where match_run_id = :run_id), 0::bigint);
```

- [ ] **Step 2: DBと統合テストを赤にする**

Run: `pnpm test:db && pnpm vitest run tests/integration/matching/process.test.ts`
Expected: FAIL for missing tables and RPCs.

- [ ] **Step 3: match、message、report、dimension、notification、Realtime publication、4 RPCを実装する**

```sql
alter table public.match_runs add constraint match_attempt_limit
check (attempt_count between 0 and 3);
alter publication supabase_realtime add table public.match_runs, public.notifications;
```

- [ ] **Step 4: 所有者検証済みAction、処理サービス、Route Handlerを実装する**

```ts
export async function POST(request: Request, context: RouteContext<"/api/match-runs/[id]/process">) {
  const { id } = await context.params;
  const result = await processOwnedMatch(id);
  return Response.json({ status: result });
}
```

- [ ] **Step 5: 同一runを二重処理しても1レポート・5軸だけになることを確認する**

Run: `pnpm test:db && pnpm vitest run tests/integration/matching/process.test.ts`
Expected: completed, one report, five dimensions, two notifications.

- [ ] **Step 6: コミットする**

```powershell
git add supabase src/features/matching src/app/api tests/integration/matching
git commit -m "feat: process mock matches atomically"
```

### Task 7: 会話中・通知・相性レポートUI

**Files:**
- Create: `src/features/matching/client/use-match-run.ts`, `src/features/notifications/server/queries.ts`
- Create: `src/app/(journey)/matching/page.tsx`, `notifications/page.tsx`, `report/page.tsx`
- Create: `src/components/report/conversation-log.tsx`, `score-bar.tsx`, `compatibility-report.tsx`
- Test: `tests/unit/report/compatibility-report.test.tsx`, `tests/e2e/matching-report.spec.ts`

**Interfaces:**
- Produces: `useMatchRun({ matchRunId, initialStatus, timeoutMs: 30000 })`
- Produces: `CompatibilityReport({ report, dimensions, messages })`
- Consumes: Task 6 persisted rows; does not consume reveal rows

- [ ] **Step 1: 5軸、引用、不一致方向の失敗テストを書く**

```tsx
render(<CompatibilityReport {...fixture} />);
expect(screen.getAllByRole("meter")).toHaveLength(5);
expect(screen.getByText("低いほど良い")).toBeVisible();
expect(screen.queryByText("山田 花子")).not.toBeInTheDocument();
```

- [ ] **Step 2: UIテストを赤にする**

Run: `pnpm vitest run tests/unit/report`
Expected: FAIL for missing report components.

- [ ] **Step 3: Realtime購読、2秒ポーリングfallback、30秒timeoutを実装する**

```ts
export type MatchViewStatus = "queued" | "processing" | "completed" | "failed" | "timed_out";
```

- [ ] **Step 4: 既存GIFと同じ順で会話中、通知、会話ログ、バー表示を実装する**

Run: `pnpm vitest run tests/unit/report && pnpm playwright test tests/e2e/matching-report.spec.ts`
Expected: completed notification opens anonymous report with five meters and evidence.

- [ ] **Step 5: コミットする**

```powershell
git add src/features/matching/client src/features/notifications "src/app/(journey)" src/components/report tests
git commit -m "feat: show match progress and compatibility report"
```

### Task 8: 一度限りの決定と承諾後開示

**Files:**
- Create: `supabase/migrations/202608130004_decision_reveal.sql`
- Create: `supabase/tests/database/003_decision_reveal.test.sql`
- Create: `src/features/decision/server/actions.ts`, `queries.ts`, `schemas.ts`
- Create: `src/components/feedback/decision-dialog.tsx`
- Create: `src/app/(journey)/reveal/page.tsx`, `src/app/(journey)/declined/page.tsx`
- Test: `tests/integration/decision/actions.test.ts`, `tests/e2e/decision-reveal.spec.ts`

**Interfaces:**
- Produces: `commitDecision({ matchRunId, kind })`
- Produces: `getCandidateReveal(matchRunId): Promise<CandidateReveal | null>`
- Consumes: completed match from Task 6

- [ ] **Step 1: 未決定・辞退・別利用者で0件、承諾で1件のpgTAPを書く**

```sql
select is((select count(*) from public.get_candidate_reveal(:run_id)), 0::bigint);
select public.commit_decision(:run_id, 'accept');
select is((select count(*) from public.get_candidate_reveal(:run_id)), 1::bigint);
```

- [ ] **Step 2: DB・Action・E2Eを赤にする**

Run: `pnpm test:db && pnpm vitest run tests/integration/decision`
Expected: FAIL for missing decision objects.

- [ ] **Step 3: INSERT-only decision、開示テーブル、2 RPCを実装する**

```sql
revoke all on public.candidate_reveals from anon, authenticated;
grant execute on function public.get_candidate_reveal(uuid) to authenticated;
```

- [ ] **Step 4: 確認ダイアログ、Action、承諾／辞退画面を実装する**

Run: `pnpm playwright test tests/e2e/decision-reveal.spec.ts`
Expected: reveal copy appears only after accept; decline never returns it; opposite retry conflicts.

- [ ] **Step 5: コミットする**

```powershell
git add supabase src/features/decision src/components/feedback "src/app/(journey)/reveal" "src/app/(journey)/declined" tests
git commit -m "feat: enforce consent-gated profile reveal"
```

### Task 9: 中断再開・修正・ホーム状態ガード

**Files:**
- Create: `src/features/interview/client/draft-store.ts`, `use-answer-submit.ts`
- Create: `src/features/matching/server/journey-state.ts`
- Create: `src/components/interview/answer-list.tsx`, `src/components/home/status-card.tsx`, `progress-steps.tsx`, `notice-list.tsx`
- Create: `src/app/page.tsx`, `src/app/(journey)/home/page.tsx`, `src/app/(journey)/mypage/page.tsx`
- Test: `tests/unit/interview/draft-store.test.ts`, `tests/unit/home/journey-state.test.ts`, `tests/e2e/interview-resume.spec.ts`, `tests/e2e/home-state.spec.ts`

**Interfaces:**
- Produces: `deriveJourneyState(snapshot): { state; primaryAction; allowedPaths }`
- Produces: `DraftStore.save/load/remove/clearForUser`
- Consumes: interview and match query results

- [ ] **Step 1: draft、revision競合、3ホーム状態の失敗テストを書く**

```ts
expect(deriveJourneyState({ answeredCount: 7, match: null }).primaryAction.href).toBe("/interview/8");
expect(deriveJourneyState({ answeredCount: 20, match: { status: "processing" } }).state).toBe("matching");
expect(deriveJourneyState({ answeredCount: 20, match: { status: "completed" } }).primaryAction.href).toBe("/report");
```

- [ ] **Step 2: テストを赤にする**

Run: `pnpm vitest run tests/unit/interview/draft-store.test.ts tests/unit/home/journey-state.test.ts`
Expected: FAIL for missing modules.

- [ ] **Step 3: user/questionキーのdraftと保存成功後削除を実装する**

```ts
export interface DraftStore {
  save(userId: string, questionCode: string, answer: string): void;
  load(userId: string, questionCode: string): string | null;
  remove(userId: string, questionCode: string): void;
  clearForUser(userId: string): void;
}
```

- [ ] **Step 4: 状態導出、root redirect、ホーム、マイページ、開始後編集ロックを実装する**

Run: `pnpm playwright test tests/e2e/interview-resume.spec.ts tests/e2e/home-state.spec.ts`
Expected: reload resumes at 8, edit works before match, lock explains conflict after match.

- [ ] **Step 5: コミットする**

```powershell
git add src/features/interview/client src/features/matching/server/journey-state.ts src/components/interview src/components/home src/app/page.tsx "src/app/(journey)/home" "src/app/(journey)/mypage" tests
git commit -m "feat: resume interviews and guide journey state"
```

### Task 10: プライバシー・FAQ・確認付きリセット

**Files:**
- Create: `supabase/migrations/202608130005_reset.sql`, `supabase/tests/database/004_reset.test.sql`
- Create: `src/features/identity/server/reset-action.ts`
- Create: `src/app/(journey)/privacy/page.tsx`, `faq/page.tsx`, `settings/page.tsx`
- Test: `tests/e2e/reset.spec.ts`

**Interfaces:**
- Produces: `resetDemo({ confirmation: "RESET" })`
- Consumes: `DraftStore.clearForUser()` from Task 9

- [ ] **Step 1: 自分だけ削除し他利用者を残すpgTAPを書く**

```sql
select public.reset_my_demo();
select is((select count(*) from public.interview_answers where owner_id = :user_a), 0::bigint);
select is((select count(*) from public.interview_answers where owner_id = :user_b), 20::bigint);
```

- [ ] **Step 2: DBテストを赤にする**

Run: `pnpm test:db`
Expected: FAIL because `reset_my_demo` is missing.

- [ ] **Step 3: トランザクション削除RPCと確認文字列付きActionを実装する**

```ts
const resetInput = z.object({ confirmation: z.literal("RESET") });
```

- [ ] **Step 4: 既存デモ文言を踏まえたプライバシー、FAQ、設定を実装する**

Run: `pnpm playwright test tests/e2e/reset.spec.ts`
Expected: cancel preserves rows; confirm deletes current user's demo and returns `/start`.

- [ ] **Step 5: コミットする**

```powershell
git add supabase src/features/identity/server/reset-action.ts "src/app/(journey)/privacy" "src/app/(journey)/faq" "src/app/(journey)/settings" tests/e2e/reset.spec.ts
git commit -m "feat: add privacy help and demo reset"
```

### Task 11: アクセシビリティと視覚忠実性

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`, `tests/e2e/performance.spec.ts`, `tests/visual/demo-fidelity.spec.ts`
- Create: `tests/visual/reference-checklist.md`
- Modify: `src/app/globals.css`, affected `*.module.css`

**Interfaces:**
- Consumes all completed pages
- Produces snapshots for 320x800, 390x844, 1280x900 centered-phone layouts

- [ ] **Step 1: axe、キーボード、reduced-motion、主要画面2秒以内のテストを作り赤にする**

```ts
const startedAt = performance.now();
await page.goto("/home");
await expect(page.locator("main")).toBeVisible();
expect(performance.now() - startedAt).toBeLessThan(2000);

const results = await new AxeBuilder({ page }).analyze();
expect(results.violations.filter((v) => v.impact === "critical" || v.impact === "serious")).toEqual([]);
```

Run: `pnpm playwright test tests/e2e/accessibility.spec.ts tests/e2e/performance.spec.ts`
Expected: initial failures identify missing labels, focus, or contrast.

- [ ] **Step 2: GIFとホーム画像から必須要素チェックリストを作る**

`tests/visual/reference-checklist.md` に配色、カード順、進捗、通知、会話、5軸バー、決定演出を画面別に列挙する。

- [ ] **Step 3: 320px、390px、PCのbaselineを作り、差分を修正する**

Run: `pnpm playwright test tests/visual/demo-fidelity.spec.ts --update-snapshots`
Expected: no horizontal overflow; checklist 100%; no animation under reduced motion.

- [ ] **Step 4: アクセシビリティと視覚テストを通す**

Run: `pnpm playwright test tests/e2e/accessibility.spec.ts tests/visual/demo-fidelity.spec.ts`
Expected: all PASS.

- [ ] **Step 5: コミットする**

```powershell
git add tests/e2e/accessibility.spec.ts tests/visual src/app/globals.css src
git commit -m "test: verify accessibility and demo fidelity"
```

### Task 12: ドキュメントと全品質ゲート

**Files:**
- Create: `README.md`
- Modify: `specs/001-avatar-matching-pilot/quickstart.md`
- Verify: all source, migration, and test files

**Interfaces:**
- Documents exact commands and environment contract from prior tasks

- [ ] **Step 1: READMEへ起動、Supabase、匿名認証、モック境界、検証手順を書く**

READMEにはDocker未導入時のホスト済み開発DB経路、秘密値を公開しない注意、PDF/GIFをpublicへ置かない注意を含める。

- [ ] **Step 2: 品質コマンドを順に実行する**

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:e2e
pnpm test:visual
pnpm build
```

Expected: every command exits 0. `test:db` を環境不足でスキップした場合は完了扱いにせず、ホスト済み開発DBかDocker環境で再実行する。

- [ ] **Step 3: 秘密・個人情報・開示漏洩を静的検索する**

Run: `rg -n "SERVICE_ROLE|SUPABASE_SERVICE_ROLE|山田 花子|株式会社カリヤ精機" src public`
Expected: service role has zero hits; reveal copy appears only in server-protected fixture/route boundaries and never in public assets.

- [ ] **Step 4: Spec Kit要求40件とタスク対応を最終確認する**

`specs/001-avatar-matching-pilot/spec.md` のFR-001〜FR-040を `tasks.md` とテスト名へ対応付け、未対応0件を確認する。

- [ ] **Step 5: コミットする**

```powershell
git add README.md specs/001-avatar-matching-pilot/quickstart.md
git commit -m "docs: add pilot setup and validation guide"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-08-13-avatar-matching-production-pilot.md`.
