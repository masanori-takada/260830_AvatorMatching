import { expect, test } from "@playwright/test";

test("匿名利用者が20問を1画面ずつ回答して20 / 20へ到達する", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();

  const freeTextOrders = new Set([4, 8, 12, 18, 20]);
  for (let order = 1; order <= 20; order += 1) {
    await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
    if (freeTextOrders.has(order)) {
      if (order === 4) {
        await page.getByLabel("回答を入力").fill("\t\n\u00a0\u3000");
        await page.getByRole("button", { name: "送信" }).click();
        // 自由記述はクライアント側で送信するため、失敗しても画面遷移せず、
        // その場に未保存の警告と再送手段を出す(FR-031)。
        await expect(page.getByRole("alert")).toBeVisible();
        await expect(page).toHaveURL(/\/interview\/4$/);
        await expect(page.getByRole("button", { name: "再送する" })).toBeVisible();
      }
      await page.getByLabel("回答を入力").fill(`自由回答 ${order}`);
      // 直前に送信が失敗していると、ボタンは「再送する」になっている。
      await page.getByRole("button", { name: /^(送信|再送する)$/ }).click();
    } else {
      await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
    }
  }

  await expect(page).toHaveURL(/\/interview\/complete$/);
  await expect(page.getByText("20 / 20")).toBeVisible();
  await page.reload();
  await expect(page.getByText("20 / 20")).toBeVisible();
  await expect(page.getByText("回答が完了しました")).toBeVisible();
});

test("開始失敗時に再試行案内を表示する", async ({ page }) => {
  await page.goto("/start?error=1");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("もう一度お試しください");
  await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();
});
