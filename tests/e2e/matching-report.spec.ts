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
  const noticeButton = page.getByRole("button").first();
  // clickの完了(=アクション実行)を待たずに、押した直後の見た目を検証する。
  // 既読化→再検証→リダイレクトはサーバーへの往復を伴い体感できるラグがあるため、
  // その間ボタンがaria-busy/disabledに切り替わることで「反応がない」という誤解と
  // 連打による二重送信を防いでいることを確認する(FR-038)。
  const clickPromise = noticeButton.click();
  await expect(noticeButton).toHaveAttribute("aria-busy", "true");
  await expect(noticeButton).toBeDisabled();
  await clickPromise;
  await expect(page.getByRole("meter")).toHaveCount(5);
});
