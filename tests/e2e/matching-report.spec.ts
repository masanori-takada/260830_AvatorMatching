import { expect, test } from "./support/access-gate";

import { reachFirstUndecidedReport, reachMatchList } from "./support/matching";

test("複数候補との匿名会話・マッチ結果一覧・5軸レポートまで確認できる", async ({ page }) => {
  await reachMatchList(page);
  // 「複数の相手と勝手に会話してきてくれた」体験の一覧: 少なくとも1件の候補カードが並ぶ。
  await expect(page.getByRole("link", { name: /相性 \d+%/u }).first()).toBeVisible();

  await page.getByRole("link", { name: /相性 \d+%/u }).first().click();

  await expect(page.getByRole("meter")).toHaveCount(5);
  await expect(page.getByText("低いほど良い")).toBeVisible();
  await expect(page.getByText("総評")).toBeVisible();
  await expect(page.getByText(/あなたのアバター/u).first()).toBeVisible();
  const preConsentMain = page.locator("main");
  await expect(preConsentMain).not.toContainText(/ルナ|陽翔|紬|蒼太|隼人|芽衣/u);
  await expect(preConsentMain).not.toContainText(
    /30代前半|20代後半|キャンプ・フットサル・旅行の計画|以下はAI生成の完全な架空プロフィールです。/u,
  );
  await expect(preConsentMain.locator('img[src*="/images/demo-candidates/"]')).toHaveCount(0);

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

test("マッチ結果一覧から候補を選んでレポートへ進める", async ({ page }) => {
  await reachFirstUndecidedReport(page);
  await expect(page.getByRole("button", { name: "今回は見送る" })).toBeVisible();
});
