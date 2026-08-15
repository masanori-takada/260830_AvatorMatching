import { expect, test, type Page } from "@playwright/test";

import { createAvatarSummary } from "../e2e/support/avatar-summary";
import { answerInterviewRange, completeInterview } from "../e2e/support/interview";

/**
 * 320px幅、390px幅、PC(1440px幅で390px端末面を中央表示)の3条件で欠落なく表示されることを
 * 確認する(FR-037, SC-010)。既存デモ(index.html/style.css)の配色・カード構成が正解である。
 *
 * スクリーンショット比較は環境差(フォントレンダリング等)の影響を受けうるため、
 * 「横スクロールが発生しないこと」は各条件で必ず構造的にも検証する。これはスナップショットと
 * 異なり環境差の影響を受けない実質的な検査である。
 */
async function assertNoHorizontalScroll(page: Page, viewportWidth: number): Promise<void> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth, `横スクロールが発生している(scrollWidth=${scrollWidth}, viewport=${viewportWidth})`).toBeLessThanOrEqual(
    viewportWidth,
  );
}

async function captureScreen(page: Page, screenName: string): Promise<void> {
  const phone = page.locator('[aria-label="アプリ画面"]');

  // 通知カード等の<time>要素は実行のたびに現在時刻から生成され値が変わるため、
  // スクリーンショット比較の対象から除外する(単色でマスクする)。
  // <time>要素の有無や配置(レイアウト)自体はマスク後も比較され続けるため、
  // マスクしても検証としての意味は失われない。画面を限定せず全画面に一律適用する。
  const timeElements = page.locator("time");

  await page.setViewportSize({ width: 320, height: 812 });
  await assertNoHorizontalScroll(page, 320);
  await expect(phone).toHaveScreenshot(`${screenName}-320.png`, { animations: "disabled", mask: [timeElements] });

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalScroll(page, 390);
  await expect(phone).toHaveScreenshot(`${screenName}-390.png`, { animations: "disabled", mask: [timeElements] });

  await page.setViewportSize({ width: 1440, height: 900 });
  await assertNoHorizontalScroll(page, 1440);
  const phoneBox = await phone.boundingBox();
  expect(phoneBox?.width).toBe(390);
  await expect(phone).toHaveScreenshot(`${screenName}-desktop.png`, { animations: "disabled", mask: [timeElements] });
}

test.describe("@visual demo fidelity (FR-037, SC-010, SC-012)", () => {
  test("承諾フローの主要画面が3条件で欠落なく表示される", async ({ page }) => {
    test.setTimeout(300_000);

    await page.goto("/start");
    await captureScreen(page, "start");

    await page.getByRole("button", { name: "インタビューをはじめる" }).click();
    await expect(page).toHaveURL(/\/interview\/1$/);
    await captureScreen(page, "interview-choice");

    await answerInterviewRange(page, 1, 3);
    await page.goto("/home");
    await captureScreen(page, "home-progress");

    await page.goto("/mypage");
    await captureScreen(page, "mypage");

    await page.goto("/settings");
    await captureScreen(page, "settings");

    await page.goto("/privacy");
    await captureScreen(page, "privacy");

    await page.goto("/faq");
    await captureScreen(page, "faq");

    await page.goto("/interview/4");
    await answerInterviewRange(page, 4, 20);
    await expect(page).toHaveURL(/\/interview\/complete$/);
    await captureScreen(page, "interview-complete");

    await createAvatarSummary(page);
    await page.goto("/matching");
    await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });
    await captureScreen(page, "matching-completed");

    await page.getByRole("link", { name: "相性レポートを見る" }).click();
    await expect(page.getByRole("meter")).toHaveCount(5);
    const reportUrl = page.url();
    await captureScreen(page, "report");

    await page.goto("/notifications");
    await captureScreen(page, "notifications");

    await page.goto(reportUrl);
    await page.getByRole("button", { name: "承諾する" }).click();
    await page.getByRole("button", { name: "承諾を確定する" }).click();
    await expect(page).toHaveURL(/\/reveal$/);
    await captureScreen(page, "reveal");
  });

  test("辞退後の/declinedが3条件で欠落なく表示される", async ({ page }) => {
    test.setTimeout(120_000);

    await completeInterview(page);
    await createAvatarSummary(page);
    await page.goto("/matching");
    await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "相性レポートを見る" }).click();
    await page.getByRole("button", { name: "辞退する" }).click();
    await page.getByRole("button", { name: "辞退を確定する" }).click();
    await expect(page).toHaveURL(/\/declined$/);
    await captureScreen(page, "declined");
  });
});
