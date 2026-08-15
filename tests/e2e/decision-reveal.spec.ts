import { expect, test, type Page } from "./support/access-gate";

import { createAvatarSummary } from "./support/avatar-summary";
import { completeInterview } from "./support/interview";

async function reachReport(page: Page) {
  await completeInterview(page);
  await createAvatarSummary(page);
  await page.goto("/matching");
  await page.getByRole("link", { name: "相性レポートを見る" }).click();
  await expect(page.getByRole("button", { name: "承諾する" })).toBeVisible();
}

test("承諾前の直URLでは漏洩せず明示承諾後だけ架空プロフィールを開示する", async ({ page }) => {
  await reachReport(page);
  const reportUrl = page.url();
  await page.goto("/reveal");
  // 未承諾で/revealへ直接アクセスすると"/"へredirectされるが、認証済みセッションは
  // "/"自体がさらに"/home"へredirectする(src/app/page.tsx)。最終到達先で検証する。
  await expect(page).toHaveURL(/\/home$/);
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
  // 未承諾で/revealへ直接アクセスすると"/"へredirectされるが、認証済みセッションは
  // "/"自体がさらに"/home"へredirectする(src/app/page.tsx)。最終到達先で検証する。
  await expect(page).toHaveURL(/\/home$/);
});
