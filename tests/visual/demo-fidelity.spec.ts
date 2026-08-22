import { expect, test, type Page } from "../e2e/support/access-gate";

import { createAvatarSummary } from "../e2e/support/avatar-summary";
import {
  answerInterviewRange,
  FIRST_CHOICE_QUESTION_ORDER,
  TOTAL_INTERVIEW_QUESTIONS,
} from "../e2e/support/interview";
import { reachMatchList } from "../e2e/support/matching";

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

/**
 * 3条件(320px/390px/PC中央)それぞれで横スクロールが発生しないことだけを検証する。
 * `captureScreen`と異なりスクリーンショット比較は行わない。
 *
 * `/matching`の処理中画面のように、モックプロバイダでも完了件数がタイミング依存で
 * 変動し画面内容が実行のたびに変わりうる画面で、それでも壊れない構造的な検査として使う。
 */
async function assertNoHorizontalScrollAllViewports(page: Page): Promise<void> {
  await page.setViewportSize({ width: 320, height: 812 });
  await assertNoHorizontalScroll(page, 320);

  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalScroll(page, 390);

  await page.setViewportSize({ width: 1440, height: 900 });
  await assertNoHorizontalScroll(page, 1440);
  const phone = page.locator('[aria-label="アプリ画面"]');
  const phoneBox = await phone.boundingBox();
  expect(phoneBox?.width).toBe(390);
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
    await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_CHOICE_QUESTION_ORDER}$`));
    await captureScreen(page, "interview-choice");

    await answerInterviewRange(page, FIRST_CHOICE_QUESTION_ORDER, FIRST_CHOICE_QUESTION_ORDER + 2);
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

    await page.goto(`/interview/${FIRST_CHOICE_QUESTION_ORDER + 3}`);
    await answerInterviewRange(page, FIRST_CHOICE_QUESTION_ORDER + 3, TOTAL_INTERVIEW_QUESTIONS);
    await expect(page).toHaveURL(/\/interview\/complete$/);
    await captureScreen(page, "interview-complete");

    await createAvatarSummary(page);
    await page.goto("/matching");
    // 「/matching」(処理中)画面は、モック応答でも各候補の完了タイミングが実行ごとに
    // ずれうるため、表示中の完了件数がスクリーンショット比較のたびに変わりうる
    // (タイミング依存で不安定)。撮影対象からは外し、横スクロールが出ないことだけを
    // 構造的に検証する(環境差やタイミングの影響を受けない検査として残す)。
    await assertNoHorizontalScrollAllViewports(page);
    await expect(page.getByRole("link", { name: /マッチ結果を見る/u })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: /マッチ結果を見る/u }).click();
    await expect(page).toHaveURL(/\/matches$/);
    await captureScreen(page, "matches");

    await page.getByRole("link", { name: /相性 \d+%/u }).first().click();
    await expect(page.getByRole("meter")).toHaveCount(5);
    const reportUrl = page.url();
    await captureScreen(page, "report");

    await page.goto("/notifications");
    // お知らせ一覧は、3件を並行処理するマッチングの完了順が実行のたびに入れ替わりうるため、
    // どの候補の通知が先に並ぶか・進捗件数(n/3件完了)の文言が実行ごとに変わりうる
    // (実際に2回連続実行して確認済み。<time>のマスクだけでは吸収できない構造的な差分)。
    // スクリーンショット比較の対象からは外し、横スクロールが出ないことだけを検証する。
    await assertNoHorizontalScrollAllViewports(page);

    await page.goto(reportUrl);
    await page.getByRole("button", { name: "承諾する" }).click();
    await page.getByRole("button", { name: "承諾を確定する" }).click();
    await expect(page).toHaveURL(/\/reveal$/);
    await captureScreen(page, "reveal");
  });

  test("辞退後の/declinedが3条件で欠落なく表示される", async ({ page }) => {
    test.setTimeout(120_000);

    await reachMatchList(page);
    await page.getByRole("link", { name: /相性 \d+%/u }).first().click();
    await page.getByRole("button", { name: "辞退する" }).click();
    await page.getByRole("button", { name: "辞退を確定する" }).click();
    await expect(page).toHaveURL(/\/declined$/);
    await captureScreen(page, "declined");
  });
});
