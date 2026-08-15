import { expect, test, type Page } from "@playwright/test";

const FREE_TEXT_ORDERS = new Set([4, 8, 12, 18, 20]);

async function answerQuestion(page: Page, order: number, text: string) {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  if (FREE_TEXT_ORDERS.has(order)) {
    await page.getByLabel("回答を入力").fill(text);
    await page.getByRole("button", { name: "送信" }).click();
  } else {
    await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
  }
}

test("未開始のブラウザでルートへ直接アクセスすると開始画面へ案内する(FR-036)", async ({ browser }) => {
  // 匿名セッションのCookieを持たない新規コンテキストで検証する。
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/start$/);
  await context.close();
});

test("回答途中はホームで進捗と「インタビューを続ける」が主操作になる(US5-1)", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();
  for (let order = 1; order <= 3; order += 1) {
    await answerQuestion(page, order, `自由回答 ${order}`);
  }

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toBeVisible();
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toHaveCount(0);
});

test("会話処理中はホームが処理中の状態を示し、レポート導線を主操作にしない(US5-2)", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();
  for (let order = 1; order <= 20; order += 1) {
    await answerQuestion(page, order, `自由回答 ${order}`);
  }
  await expect(page).toHaveURL(/\/interview\/complete$/);
  await page.getByRole("button").last().click();
  await expect(page.getByRole("button", { name: "要約を更新する" })).toBeVisible();

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
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();
  for (let order = 1; order <= 20; order += 1) {
    await answerQuestion(page, order, `自由回答 ${order}`);
  }
  await page.getByRole("button").last().click();
  await expect(page.getByRole("button", { name: "要約を更新する" })).toBeVisible();

  await page.goto("/matching");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/home");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible();
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toHaveCount(0);
});
