import { expect, test } from "./support/access-gate";

import { reachMatchList } from "./support/matching";

/**
 * DB migration適用済みのローカル環境で実行する二段階承認の契約。
 * このspecは本番へ接続せず、ホストDBとテストユーザーを用意した環境でだけ実行する。
 */
test("三候補から開示・見送り・再選択・接続・chat・resetまでを通過する", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 812 });
  await reachMatchList(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const candidates = page.getByRole("link", { name: /相性 \d+%/u });
  await expect(candidates).toHaveCount(3);
  const firstReport = await candidates.nth(0).getAttribute("href");
  const secondReport = await candidates.nth(1).getAttribute("href");
  expect(firstReport).toMatch(/^\/report\?matchRunId=/u);
  expect(secondReport).toMatch(/^\/report\?matchRunId=/u);

  await candidates.nth(0).click();
  await page.getByRole("button", { name: "プロフィール開示を希望" }).click();
  await page.getByRole("dialog", { name: "プロフィール開示を確認" })
    .getByRole("button", { name: "プロフィール開示を確定" }).click();
  await expect(page).toHaveURL(/\/reveal\?matchRunId=/);
  await expect(page.getByText("AI生成の完全な架空プロフィールです。")).toBeVisible();
  await expect(page.getByRole("heading", { name: "陽翔" })).toBeVisible();
  await expect(page.getByText("キャンプ・フットサル・旅行の計画")).toBeVisible();
  await expect(page.getByText(/姓・会社・部署|メールアドレス|電話番号/u)).toHaveCount(0);
  await expect(page.getByRole("img").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

  const firstRevealUrl = page.url();
  await page.goto("/chat");
  await expect(page).not.toHaveURL(/\/chat$/);
  await page.goto(firstRevealUrl);

  await page.getByRole("button", { name: "今回は見送る" }).click();
  await page.getByRole("dialog", { name: "見送りを確認" })
    .getByRole("button", { name: "今回は見送る" }).click();
  await expect(page).toHaveURL(/\/matches$/);
  await expect(page.getByText("見送り済み").first()).toBeVisible();

  await page.goto(secondReport!);
  await page.getByRole("button", { name: "プロフィール開示を希望" }).click();
  await page.getByRole("dialog", { name: "プロフィール開示を確認" })
    .getByRole("button", { name: "プロフィール開示を確定" }).click();
  await expect(page).toHaveURL(/\/reveal\?matchRunId=/);
  await expect(page.getByRole("heading", { name: "蒼太" })).toBeVisible();
  await expect(page.getByText("バスケットボール・ロードバイク・筋力トレーニング")).toBeVisible();
  await expect(page.getByRole("heading", { name: "陽翔" })).toHaveCount(0);

  await page.getByRole("button", { name: "連絡を希望する" }).click();
  const contactDialog = page.getByRole("dialog", { name: "連絡希望を確認" });
  const contactConfirm = contactDialog.getByRole("button", { name: "連絡を希望する" });
  const contactClick = contactConfirm.click();
  await expect(contactConfirm).toBeDisabled();
  await expect(contactConfirm).toHaveAttribute("aria-busy", "true");
  await contactClick;
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText("まずは気軽にお話ししませんか？")).toBeVisible();

  await page.goto("/notifications");
  const contactReady = page.getByRole("button", { name: /チャットがはじまりました/u });
  await expect(contactReady).toBeVisible();
  await contactReady.click();
  await expect(page).toHaveURL(/\/chat$/);

  const composer = page.getByRole("textbox", { name: "メッセージ" });
  await composer.fill("  こんにちは  ");
  const send = page.getByRole("button", { name: "送信" });
  const sendClick = send.dblclick();
  await expect(send).toBeDisabled();
  await expect(send).toHaveAttribute("aria-busy", "true");
  await sendClick;
  await expect(page.getByText("こんにちは", { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.reload();
  await expect(page.getByText("こんにちは", { exact: true })).toHaveCount(1);

  await page.goto("/settings");
  await page.getByRole("button", { name: "デモをリセット" }).click();
  await page.getByRole("dialog", { name: "デモをリセット" })
    .getByRole("button", { name: "リセットする" }).click();
  await expect(page).toHaveURL(/\/start$/);
  await page.goto("/notifications");
  await expect(page.getByText("まだお知らせはありません。")).toBeVisible();
});
