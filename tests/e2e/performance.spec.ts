import { expect, test, type Page } from "@playwright/test";

import { createAvatarSummary } from "./support/avatar-summary";
import { answerInterviewRange, completeInterview } from "./support/interview";

const BUDGET_MS = 2_000;
const SAMPLES = 3;

/**
 * 同一URLへの再訪問を複数回計測し、中央値を採用する。
 *
 * 1回の計測だけで閾値ぎりぎりを判定すると、ネットワーク往復の外れ値1回で
 * テストが不安定になる。ここでは同じ画面へ`SAMPLES`回goto()し直し、
 * 「goto開始」から「主要な可視要素が表示されるまで」(=サーバー応答+クライアント描画)
 * を計測して中央値を取る。
 */
async function medianLoadMs(
  page: Page,
  url: string,
  waitForReady: () => Promise<unknown>,
  samples = SAMPLES,
): Promise<number> {
  const durations: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const start = Date.now();
    await page.goto(url);
    await waitForReady();
    durations.push(Date.now() - start);
  }
  durations.sort((a, b) => a - b);
  return durations[Math.floor(durations.length / 2)]!;
}

function reportMedian(screen: string, ms: number): void {
  console.log(`[perf] ${screen}: 中央値 ${ms}ms (${SAMPLES}回計測)`);
}

async function expectWithinBudget(page: Page, screen: string, url: string, waitForReady: () => Promise<unknown>) {
  const ms = await medianLoadMs(page, url, waitForReady);
  reportMedian(screen, ms);
  expect(ms, `${screen} の表示が${BUDGET_MS}msを超えた(中央値${ms}ms)`).toBeLessThanOrEqual(BUDGET_MS);
}

// 現在の実行環境はSupabase Cloud(リモート)へ接続しているため、実測値はローカルDBより
// 素直な値にはならない。閾値を超える画面があれば、テストを甘くせずそのまま失敗として報告する。
test.describe("performance (2s budget, SC-010 fidelity gate companion)", () => {
  test("承諾フローの主要画面の表示が2秒以内(中央値)", async ({ page }) => {
    test.setTimeout(300_000);

    await expectWithinBudget(page, "/start", "/start", () =>
      expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible());

    await page.getByRole("button", { name: "インタビューをはじめる" }).click();
    await expect(page).toHaveURL(/\/interview\/1$/);

    await expectWithinBudget(page, "/interview/1", "/interview/1", () =>
      expect(page.getByRole("group", { name: "回答を選択" })).toBeVisible());

    await answerInterviewRange(page, 1, 3);

    await expectWithinBudget(page, "/home(進行中)", "/home", () =>
      expect(page.getByRole("link", { name: "インタビューを続ける" })).toBeVisible());

    await expectWithinBudget(page, "/mypage", "/mypage", () =>
      expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible());

    await expectWithinBudget(page, "/settings", "/settings", () =>
      expect(page.getByRole("heading", { name: "設定" })).toBeVisible());

    await expectWithinBudget(page, "/privacy", "/privacy", () =>
      expect(page.getByRole("heading", { name: "プライバシーについて" })).toBeVisible());

    await expectWithinBudget(page, "/faq", "/faq", () =>
      expect(page.getByRole("heading", { name: "よくある質問" })).toBeVisible());

    await page.goto("/interview/4");
    await answerInterviewRange(page, 4, 20);
    await expect(page).toHaveURL(/\/interview\/complete$/);

    await expectWithinBudget(page, "/interview/complete", "/interview/complete", () =>
      expect(page.getByRole("button", { name: "アバター要約を作成する" })).toBeVisible());

    await createAvatarSummary(page);
    await page.goto("/matching");
    await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });

    await expectWithinBudget(page, "/matching(完了)", "/matching", () =>
      expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 }));

    await page.getByRole("link", { name: "相性レポートを見る" }).click();
    await expect(page.getByRole("meter")).toHaveCount(5);
    const reportUrl = page.url();

    await expectWithinBudget(page, "/report", reportUrl, () => expect(page.getByRole("meter")).toHaveCount(5));

    await expectWithinBudget(page, "/notifications", "/notifications", () =>
      expect(page.getByRole("heading", { name: "お知らせ" })).toBeVisible());

    await page.goto(reportUrl);
    await page.getByRole("button", { name: "承諾する" }).click();
    await page.getByRole("button", { name: "承諾を確定する" }).click();
    await expect(page).toHaveURL(/\/reveal$/);

    await expectWithinBudget(page, "/reveal", "/reveal", () =>
      expect(page.getByRole("heading", { name: "承諾後のプロフィール" })).toBeVisible());
  });

  test("辞退後の/declinedの表示が2秒以内(中央値)", async ({ page }) => {
    test.setTimeout(120_000);

    await completeInterview(page);
    await createAvatarSummary(page);
    await page.goto("/matching");
    await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "相性レポートを見る" }).click();
    await page.getByRole("button", { name: "辞退する" }).click();
    await page.getByRole("button", { name: "辞退を確定する" }).click();
    await expect(page).toHaveURL(/\/declined$/);

    await expectWithinBudget(page, "/declined", "/declined", () =>
      expect(page.getByRole("heading", { name: "今回は見送りました" })).toBeVisible());
  });
});
