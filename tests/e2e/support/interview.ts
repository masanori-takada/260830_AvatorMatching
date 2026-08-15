import { expect, type Page } from "@playwright/test";

/**
 * 自由記述で回答する設問の順序番号。
 */
export const FREE_TEXT_ORDERS = new Set([4, 8, 12, 18, 20]);

/**
 * `/start` からインタビューを開始する。
 */
export async function startInterview(page: Page): Promise<void> {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();
}

/**
 * インタビューの1問に回答する。
 *
 * 各設問への遷移はクライアント側で非同期に行われるため、回答前に必ずURLの到達を
 * 待ち合わせる。これを怠ると次の設問の要素がまだDOMに無く、ロケータ待機が
 * タイムアウトする(自由記述設問で特に顕著)。
 */
export async function answerInterviewQuestion(page: Page, order: number, text = `自由回答 ${order}`): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  if (FREE_TEXT_ORDERS.has(order)) {
    await page.getByLabel("回答を入力").fill(text);
    await page.getByRole("button", { name: "送信" }).click();
  } else {
    await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
  }
}

/**
 * `from`〜`to` の設問へ順に回答する(1問ごとにURL到達を待ち合わせる)。
 */
export async function answerInterviewRange(page: Page, from: number, to: number): Promise<void> {
  for (let order = from; order <= to; order += 1) {
    await answerInterviewQuestion(page, order);
  }
}

/**
 * インタビューを開始し、1問目から20問目まで回答して完了画面へ到達する。
 */
export async function completeInterview(page: Page): Promise<void> {
  await startInterview(page);
  await answerInterviewRange(page, 1, 20);
  await expect(page).toHaveURL(/\/interview\/complete$/);
}
