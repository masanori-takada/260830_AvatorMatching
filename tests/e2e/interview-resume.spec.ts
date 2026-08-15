import { expect, test, type Page } from "@playwright/test";

const FREE_TEXT_ORDERS = new Set([4, 8, 12, 18, 20]);

async function answerQuestion(page: Page, order: number, text: string) {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  if (FREE_TEXT_ORDERS.has(order)) {
    await page.getByLabel("回答を入力").fill(text);
    await page.getByRole("button", { name: "送信" }).click();
  } else {
    await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
  }
}

async function answerThroughOrder(page: Page, upToOrder: number) {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();
  for (let order = 1; order <= upToOrder; order += 1) {
    await answerQuestion(page, order, `自由回答 ${order}`);
  }
}

async function completeAllQuestions(page: Page) {
  await answerThroughOrder(page, 20);
  await expect(page).toHaveURL(/\/interview\/complete$/);
  await page.getByRole("button").last().click();
  await expect(page.getByRole("button", { name: "要約を更新する" })).toBeVisible();
}

test("7問回答後に端末を離れても、再度開くと8問目から再開できる(FR-007)", async ({ page }) => {
  await answerThroughOrder(page, 7);
  await expect(page).toHaveURL(/\/interview\/8$/);

  // 端末を閉じて再度開いた想定でルートへアクセスし、保存済み状態から
  // 到達可能な画面(ホーム経由で8問目)へ戻れることを確認する。
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "インタビューを続ける" })).toHaveAttribute("href", "/interview/8");
  await page.getByRole("link", { name: "インタビューを続ける" }).click();
  await expect(page).toHaveURL(/\/interview\/8$/);
});

test("マッチング開始前はマイページから回答済み質問を修正できる(FR-008)", async ({ page }) => {
  await answerThroughOrder(page, 3);

  await page.goto("/mypage");
  await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();
  await expect(page.getByText("外へ出かける")).toBeVisible();

  await page.getByRole("link", { name: "修正する" }).first().click();
  await expect(page).toHaveURL(/\/interview\/1$/);
  await page.getByRole("group", { name: "回答を選択" }).getByRole("button", { name: "家でゆっくりする" }).click();

  await page.goto("/mypage");
  await expect(page.getByText("家でゆっくりする")).toBeVisible();
});

test("マッチング処理開始後は回答修正ができないことを説明する(FR-008, エッジケース)", async ({ page }) => {
  await completeAllQuestions(page);
  await page.goto("/matching");
  await expect(page.getByRole("link", { name: "相性レポートを見る" })).toBeVisible({ timeout: 30_000 });

  await page.goto("/mypage");
  await expect(page.getByRole("status")).toContainText("マッチング開始後は回答を変更できません");
  await expect(page.getByRole("link", { name: "修正する" })).toHaveCount(0);

  await page.goto("/interview/1");
  await expect(page.getByText("マッチング開始後は回答を変更できません")).toBeVisible();
});
