import { expect, test } from "./support/access-gate";

test("匿名利用者が41問を1画面ずつ回答して41 / 41へ到達する", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();

  // 自由記述の設問(q04, q08, q12, q18, q20)は、基本プロフィール17問+開示意思4問が
  // 表示順の先頭に入った結果、表示順25/29/33/39/41に移動している。
  const freeTextOrders = new Set([25, 29, 33, 39, 41]);
  for (let order = 1; order <= 41; order += 1) {
    await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
    if (freeTextOrders.has(order)) {
      if (order === 25) {
        await page.getByLabel("回答を入力").fill("\t\n\u00a0\u3000");
        await page.getByRole("button", { name: "送信" }).click();
        // 自由記述はクライアント側で送信するため、失敗しても画面遷移せず、
        // その場に未保存の警告と再送手段を出す(FR-031)。
        // 注意: page から直接 getByRole で alert/status 等のライブリージョンロールを
        // スコープを絞らずに取得すると、画面遷移直後だけ中身を持つNext.jsのルート
        // アナウンサー(#__next-route-announcer__)と衝突しstrict mode violationになる
        // ことがある。getByRole("main")等で祖先を絞り込むこと(再発防止テスト:
        // tests/unit/config/scoped-live-region-locator.test.ts)。
        await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
        await expect(page).toHaveURL(/\/interview\/25$/);
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
  await expect(page.getByText("41 / 41")).toBeVisible();
  await page.reload();
  await expect(page.getByText("41 / 41")).toBeVisible();
  await expect(page.getByText("回答が完了しました")).toBeVisible();
});

test("開始失敗時に再試行案内を表示する", async ({ page }) => {
  await page.goto("/start?error=1");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("もう一度お試しください");
  await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();
});
