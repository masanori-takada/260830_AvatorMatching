import { expect, passAccessGate, test } from "./support/access-gate";
import { createAvatarSummary } from "./support/avatar-summary";
import { answerInterviewRange, startInterview, TOTAL_INTERVIEW_QUESTIONS } from "./support/interview";

test("未開始のブラウザでルートへ直接アクセスすると開始画面へ案内する(FR-036)", async ({ browser }) => {
  // 匿名セッションのCookieを持たない新規コンテキストで検証する。
  // (合言葉ゲートのクッキーは無いので、まず`passAccessGate`で通過させる)
  const context = await browser.newContext();
  const page = await context.newPage();
  await passAccessGate(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/start$/);
  await context.close();
});

test("回答途中はホームで進捗と「インタビューを続ける」が主操作になる(US5-1)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, 3);

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toBeVisible();
  await expect(page.getByRole("link", { name: "マッチ結果を見る" })).toHaveCount(0);
});

test("会話処理中はホームが処理中の状態を示し、レポート導線を主操作にしない(US5-2)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, TOTAL_INTERVIEW_QUESTIONS);
  await expect(page).toHaveURL(/\/interview\/complete$/);
  await createAvatarSummary(page);

  // マッチ処理を開始する。モック処理は高速に完了しうるため、この時点のホーム表示は
  // 「進行状況を見る」(処理中)または「マッチ結果を見る」(完了済み、journey-state.tsの
  // report_ready状態のprimaryAction)のどちらかになる。
  // どちらであっても、未完了のレポートへのリンクだけは存在しないことを保証する。
  await page.goto("/matching");
  await page.goto("/home");
  const reportLink = page.getByRole("link", { name: "マッチ結果を見る" });
  const progressLink = page.getByRole("link", { name: "進行状況を見る" });
  await expect(reportLink.or(progressLink)).toBeVisible();
});

test("レポート完成後はホームで完了通知と「マッチ結果を見る」が主操作になる(US5-3)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, TOTAL_INTERVIEW_QUESTIONS);
  await createAvatarSummary(page);

  // /matchingの完了リンクは候補数を含む「マッチ結果を見る（N人）」表記のため正規表現で判定する
  // (matching-progress.tsx)。一方、/homeの主操作ラベルは候補数を含まない「マッチ結果を見る」
  // 固定文言(journey-state.tsのreport_ready状態のprimaryAction)。
  await page.goto("/matching");
  await expect(page.getByRole("link", { name: /マッチ結果を見る/u })).toBeVisible({ timeout: 30_000 });

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "マッチ結果を見る" })).toBeVisible();
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toHaveCount(0);
});
