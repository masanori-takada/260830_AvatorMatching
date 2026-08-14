import { expect, test } from "@playwright/test";

test("匿名利用者が20問を1画面ずつ回答して20 / 20へ到達する", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();

  const freeTextOrders = new Set([4, 8, 12, 18, 20]);
  for (let order = 1; order <= 20; order += 1) {
    await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
    if (freeTextOrders.has(order)) {
      await page.getByLabel("回答を入力").fill(`自由回答 ${order}`);
      await page.getByRole("button", { name: "送信" }).click();
    } else {
      await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
    }
  }

  await expect(page).toHaveURL(/\/interview\/complete$/);
  await expect(page.getByText("20 / 20")).toBeVisible();
});
