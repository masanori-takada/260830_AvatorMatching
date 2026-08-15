import { expect, test, type Page } from "@playwright/test";

async function reachReport(page: Page) {
  await page.goto("/start");
  await page.getByRole("button").first().click();
  const freeTextOrders = new Set([4, 8, 12, 18, 20]);
  for (let order = 1; order <= 20; order += 1) {
    if (freeTextOrders.has(order)) {
      await page.getByRole("textbox").fill(`安全な自由回答 ${order}`);
      await page.getByRole("button", { name: "送信" }).click();
    } else {
      await page.getByRole("group").getByRole("button").first().click();
    }
  }
  await page.getByRole("button").last().click();
  await page.goto("/matching");
  await page.getByRole("link", { name: "相性レポートを見る" }).click();
  await expect(page.getByRole("button", { name: "承諾する" })).toBeVisible();
}

test("承諾前の直URLでは漏洩せず明示承諾後だけ架空プロフィールを開示する", async ({ page }) => {
  await reachReport(page);
  const reportUrl = page.url();
  await page.goto("/reveal");
  await expect(page).toHaveURL(/\/$/);
  await page.goto(reportUrl);
  await page.getByRole("button", { name: "承諾する" }).click();
  await page.getByRole("button", { name: "承諾を確定する" }).click();
  await expect(page).toHaveURL(/\/reveal$/);
  await expect(page.getByText("以下は本デモ用の完全な架空情報です。")).toBeVisible();
});

test("辞退後も候補者情報を開示しない", async ({ page }) => {
  await reachReport(page);
  await page.getByRole("button", { name: "辞退する" }).click();
  await page.getByRole("button", { name: "辞退を確定する" }).click();
  await expect(page).toHaveURL(/\/declined$/);
  await expect(page.locator("main")).not.toContainText(/星乃|ルミナス架空企画|未来対話デザイン室/u);
  await page.goto("/reveal");
  await expect(page).toHaveURL(/\/$/);
});
