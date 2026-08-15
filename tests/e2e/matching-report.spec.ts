import { expect, test } from "./support/access-gate";

import { createAvatarSummary } from "./support/avatar-summary";
import { completeInterview } from "./support/interview";

test("20回答から匿名会話・通知・5軸レポートまで確認できる", async ({ page }) => {
  await completeInterview(page);
  await createAvatarSummary(page);
  await page.goto("/matching");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("link", { name: "相性レポートを見る" }).click();

  await expect(page.getByRole("meter")).toHaveCount(5);
  await expect(page.getByText("低いほど良い")).toBeVisible();
  await expect(page.getByText("総評")).toBeVisible();
  await expect(page.getByText(/あなたのアバター/u).first()).toBeVisible();
  // ラベル語(氏名・会社・部署など)での判定は、正当なUI文言
  // (例:「承諾するまで氏名や所属は開示されません。」という決定セクションの説明文)にも
  // 一致してしまい誤検知する。承諾前に検査すべきなのは「承諾後にだけ開示される
  // 架空プロフィールの実データが漏れていないか」なので、その具体値で判定する。
  await expect(page.locator("main")).not.toContainText(/星乃|ルミナス架空企画|未来対話デザイン室/u);

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "お知らせ" })).toBeVisible();
  await page.getByRole("button").first().click();
  await expect(page.getByRole("meter")).toHaveCount(5);
});
