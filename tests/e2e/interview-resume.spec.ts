import { expect, test, type Page } from "./support/access-gate";

import { createAvatarSummary } from "./support/avatar-summary";
import {
  answerInterviewRange,
  FIRST_CHOICE_OPTION_1,
  FIRST_CHOICE_OPTION_2,
  FIRST_CHOICE_QUESTION_ORDER,
  selectInterviewChoice,
  startInterview,
  TOTAL_INTERVIEW_QUESTIONS,
} from "./support/interview";

async function answerThroughOrder(page: Page, upToOrder: number) {
  await startInterview(page);
  await answerInterviewRange(page, 1, upToOrder);
}

async function completeAllQuestions(page: Page) {
  await answerThroughOrder(page, TOTAL_INTERVIEW_QUESTIONS);
  await expect(page).toHaveURL(/\/interview\/complete$/);
  await createAvatarSummary(page);
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
  // 最初の選択式質問を含む範囲まで回答する(元のテスト意図「複数問回答した状態」を保つため最低3問は回答する)。
  const answeredThrough = Math.max(3, FIRST_CHOICE_QUESTION_ORDER);
  await answerThroughOrder(page, answeredThrough);

  await page.goto("/mypage");
  await expect(page.getByRole("heading", { name: "マイページ" })).toBeVisible();
  await expect(page.getByText(FIRST_CHOICE_OPTION_1)).toBeVisible();

  // マイページの「修正する」リンクは回答済み質問を表示順(displayOrder)昇順で並べる前提のため、
  // 最初の選択式質問(FIRST_CHOICE_QUESTION_ORDER)に対応するリンクをその位置(0始まり)で選ぶ。
  await page.getByRole("link", { name: "修正する" }).nth(FIRST_CHOICE_QUESTION_ORDER - 1).click();
  await expect(page).toHaveURL(new RegExp(`/interview/${FIRST_CHOICE_QUESTION_ORDER}$`));
  await selectInterviewChoice(page, FIRST_CHOICE_QUESTION_ORDER, 1);
  // Server Actionによる保存が完了する前に画面を離れると保存が中断されうるため、
  // 未回答の次の設問へのリダイレクト完了を待ってから遷移する。
  // 1〜answeredThroughは既に回答済み(修正対象も回答済みのまま)のため、
  // 次の未回答設問は answeredThrough + 1 になる。
  await expect(page).toHaveURL(new RegExp(`/interview/${answeredThrough + 1}$`));

  await page.goto("/mypage");
  await expect(page.getByText(FIRST_CHOICE_OPTION_2)).toBeVisible();
});

test("マッチング処理開始後は回答修正ができないことを説明する(FR-008, エッジケース)", async ({ page }) => {
  await completeAllQuestions(page);
  await page.goto("/matching");
  // /matchingの完了リンクは候補数を含む「マッチ結果を見る（N人）」表記のため正規表現で判定する
  // (matching-progress.tsx)。ここではマッチング開始後の状態に到達できればよく、
  // 個別レポートへ進む必要はない。
  await expect(page.getByRole("link", { name: /マッチ結果を見る/u })).toBeVisible({ timeout: 30_000 });

  await page.goto("/mypage");
  await expect(page.getByRole("main").getByRole("status")).toContainText("マッチング開始後は回答を変更できません");
  await expect(page.getByRole("link", { name: "修正する" })).toHaveCount(0);

  await page.goto("/interview/1");
  await expect(page.getByText("マッチング開始後は回答を変更できません")).toBeVisible();
});
