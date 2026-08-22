import { expect, test } from "./support/access-gate";

import {
  FIRST_CHOICE_OPTION_1,
  FIRST_CHOICE_OPTION_2,
  FIRST_CHOICE_QUESTION_ORDER,
  FIRST_FREE_TEXT_QUESTION_ORDER,
  FREE_TEXT_QUESTION_ORDERS,
  startInterview,
  TOTAL_INTERVIEW_QUESTIONS,
} from "./support/interview";

test("匿名利用者が全問を1画面ずつ回答して完了画面へ到達する", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: "インタビューをはじめる" }).click();

  // 自由記述の設問の表示順はdomain.tsの質問定義から機械的に導出する
  // (質問の追加・並び替えでずれても追随できるようにするため)。
  const freeTextOrders = new Set(FREE_TEXT_QUESTION_ORDERS);
  for (let order = 1; order <= TOTAL_INTERVIEW_QUESTIONS; order += 1) {
    await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
    if (freeTextOrders.has(order)) {
      if (order === FIRST_FREE_TEXT_QUESTION_ORDER) {
        await page.getByLabel("回答を入力").fill("\t\n\u00a0　");
        await page.getByRole("button", { name: "送信" }).click();
        // 自由記述はクライアント側で送信するため、失敗しても画面遷移せず、
        // その場に未保存の警告と再送手段を出す(FR-031)。
        // 注意: page から直接 getByRole で alert/status 等のライブリージョンロールを
        // スコープを絞らずに取得すると、画面遷移直後だけ中身を持つNext.jsのルート
        // アナウンサー(#__next-route-announcer__)と衝突しstrict mode violationになる
        // ことがある。getByRole("main")等で祖先を絞り込むこと(再発防止テスト:
        // tests/unit/config/scoped-live-region-locator.test.ts)。
        await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_FREE_TEXT_QUESTION_ORDER}$`));
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
  await expect(page.getByText(`${TOTAL_INTERVIEW_QUESTIONS} / ${TOTAL_INTERVIEW_QUESTIONS}`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${TOTAL_INTERVIEW_QUESTIONS} / ${TOTAL_INTERVIEW_QUESTIONS}`)).toBeVisible();
  await expect(page.getByText("回答が完了しました")).toBeVisible();
});

test("開始失敗時に再試行案内を表示する", async ({ page }) => {
  await page.goto("/start?error=1");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("もう一度お試しください");
  await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();
});

test("「インタビューをはじめる」は押した瞬間にaria-busy/disabledになる", async ({ page }) => {
  await page.goto("/start");
  const startButton = page.getByRole("button", { name: "インタビューをはじめる" });
  // clickの完了(=Server Actionの実行・リダイレクト)を待たずに、押した直後の見た目を検証する。
  // サーバーへの往復を伴いラグが生じるため、その間ボタンがaria-busy/disabledに切り替わることで
  // 「反応がない」という誤解と連打による二重送信を防いでいることを確認する。
  const clickPromise = startButton.click();
  await expect(startButton).toHaveAttribute("aria-busy", "true");
  await expect(startButton).toBeDisabled();
  await clickPromise;
  await expect(page).toHaveURL(new RegExp("/interview/1(?:\\?.*)?$"));
});

test("選択式の回答ボタンは押した瞬間にaria-busy/disabledになり、押した選択肢だけが分かる", async ({ page }) => {
  await startInterview(page);
  await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_CHOICE_QUESTION_ORDER}(?:\\?.*)?$`));

  const group = page.getByRole("group", { name: "回答を選択" });
  const pressedButton = group.getByRole("button", { name: FIRST_CHOICE_OPTION_1, exact: true });
  const otherButton = group.getByRole("button", { name: FIRST_CHOICE_OPTION_2, exact: true });

  const clickPromise = pressedButton.click();
  // 押した選択肢だけがaria-busy(=どれを押したか分かる)。
  await expect(pressedButton).toHaveAttribute("aria-busy", "true");
  await expect(pressedButton).toBeDisabled();
  // 二重送信防止のため、押していない選択肢もあわせて無効化されるが、
  // busy(処理中)であることまでは示さない(押していないため)。
  await expect(otherButton).toBeDisabled();
  await expect(otherButton).not.toHaveAttribute("aria-busy", "true");
  await clickPromise;
});

test("自由記述の送信ボタンは押した瞬間にaria-busy/disabledになる", async ({ page }) => {
  await startInterview(page);
  for (let order = 1; order < FIRST_FREE_TEXT_QUESTION_ORDER; order += 1) {
    await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
    await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
  }
  await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_FREE_TEXT_QUESTION_ORDER}(?:\\?.*)?$`));

  await page.getByLabel("回答を入力").fill("送信ボタンの見た目を確認するための回答");
  const sendButton = page.getByRole("button", { name: "送信" });
  const clickPromise = sendButton.click();
  await expect(sendButton).toHaveAttribute("aria-busy", "true");
  await expect(sendButton).toBeDisabled();
  await clickPromise;
});
