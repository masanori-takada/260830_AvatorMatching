import { expect, test } from "./support/access-gate";

import { answerInterviewRange, startInterview } from "./support/interview";

test("設定画面からプライバシー説明・FAQへ遷移できる", async ({ page }) => {
  await startInterview(page);
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "設定" })).toBeVisible();

  await page.getByRole("link", { name: "プライバシーについて" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "プライバシーについて" })).toBeVisible();
  await expect(page.getByText("実名・メールアドレス・電話番号は収集しません")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("link", { name: "よくある質問" }).click();
  await expect(page).toHaveURL(/\/faq$/);
  await expect(page.getByRole("heading", { name: "よくある質問" })).toBeVisible();
  await expect(page.getByText("相手は私のことをどこまで知っていますか?")).toBeVisible();
});

test("回答済みの状態でリセットすると確認のうえ開始画面へ戻り、以前の回答は残らない(FR-035)", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, 5);

  await page.goto("/mypage");
  await expect(page.getByText("外へ出かける")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "デモをリセット" }).click();

  const dialog = page.getByRole("dialog", { name: "デモをリセット" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("この操作は取り消せません")).toBeVisible();

  await dialog.getByRole("button", { name: "リセットする" }).click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();

  await page.goto("/mypage");
  await expect(page.getByText("外へ出かける")).toHaveCount(0);
  await expect(page.getByText("未回答").first()).toBeVisible();
});

test("確認ダイアログはキャンセルでき、その場合は削除されない", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, 3);

  await page.goto("/settings");
  await page.getByRole("button", { name: "デモをリセット" }).click();
  const dialog = page.getByRole("dialog", { name: "デモをリセット" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/mypage");
  await expect(page.getByText("外へ出かける")).toBeVisible();
});
