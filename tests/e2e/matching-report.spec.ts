import { expect, test } from "@playwright/test";

test("20回答から匿名会話・通知・5軸レポートまで確認できる", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button").first().click();

  const freeTextOrders = new Set([4, 8, 12, 18, 20]);
  for (let order = 1; order <= 20; order += 1) {
    await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
    if (freeTextOrders.has(order)) {
      await page.getByRole("textbox").fill(`安全な自由回答 ${order}`);
      await page.getByRole("button", { name: "送信" }).click();
    } else {
      await page.getByRole("group").getByRole("button").first().click();
    }
  }

  await page.getByRole("button").last().click();
  await expect(page.getByRole("button", { name: "要約を更新する" })).toBeVisible();
  await page.goto("/matching");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "相性レポートを見る" }).click();

  await expect(page.getByRole("meter")).toHaveCount(5);
  await expect(page.getByText("低いほど良い")).toBeVisible();
  await expect(page.getByText("総評")).toBeVisible();
  await expect(page.getByText(/あなたのアバター/u).first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/氏名|会社|部署/u);

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "お知らせ" })).toBeVisible();
  await page.getByRole("button").first().click();
  await expect(page.getByRole("meter")).toHaveCount(5);
});
