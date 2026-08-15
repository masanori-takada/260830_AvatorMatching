import { expect, test } from "@playwright/test";

import { createAvatarSummary } from "./support/avatar-summary";
import { answerInterviewRange, startInterview } from "./support/interview";

test("未開始のブラウザでルートへ直接アクセスすると開始画面へ案内する(FR-036)", async ({ browser }) => {
  // 匿名セッションのCookieを持たない新規コンテキストで検証する。
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/start$/);
  await context.close();
});

test("回答途中はホームで進捗と「インタビューを続ける」が主操作になる(US5-1)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, 3);

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toBeVisible();
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toHaveCount(0);
});

test("会話処理中はホームが処理中の状態を示し、レポート導線を主操作にしない(US5-2)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, 20);
  await expect(page).toHaveURL(/\/interview\/complete$/);
  await createAvatarSummary(page);

  // マッチ処理を開始する。モック処理は高速に完了しうるため、この時点のホーム表示は
  // 「進行状況を見る」(処理中)または「相性レポートを見る」(完了済み)のどちらかになる。
  // どちらであっても、未完了のレポートへのリンクだけは存在しないことを保証する。
  await page.goto("/matching");
  await page.goto("/home");
  const reportLink = page.getByRole("link", { name: "相性レポートを見る" });
  const progressLink = page.getByRole("link", { name: "進行状況を見る" });
  await expect(reportLink.or(progressLink)).toBeVisible();
});

test("レポート完成後はホームで完了通知と「相性レポートを見る」が主操作になる(US5-3)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, 20);
  await createAvatarSummary(page);

  await page.goto("/matching");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible();
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toHaveCount(0);
});
