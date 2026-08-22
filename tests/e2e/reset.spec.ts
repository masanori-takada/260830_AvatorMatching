import { expect, test } from "./support/access-gate";

import {
  answerInterviewRange,
  FIRST_CHOICE_OPTION_1,
  FIRST_CHOICE_QUESTION_ORDER,
  mypageAnswerLocator,
  startInterview,
} from "./support/interview";
import { reachFirstUndecidedReport } from "./support/matching";

// 選択式の質問に1問も回答していない状態は想定しづらいため、最初の選択式質問を含む
// 範囲まで回答する(元のテスト意図「複数問回答した状態」を保つため最低5問は回答する)。
const ANSWER_THROUGH = Math.max(5, FIRST_CHOICE_QUESTION_ORDER);

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
  await answerInterviewRange(page, 1, ANSWER_THROUGH);

  await page.goto("/mypage");
  await expect(mypageAnswerLocator(page, FIRST_CHOICE_QUESTION_ORDER).getByText(FIRST_CHOICE_OPTION_1)).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "デモをリセット" }).click();

  const dialog = page.getByRole("dialog", { name: "デモをリセット" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("この操作は取り消せません")).toBeVisible();

  await dialog.getByRole("button", { name: "リセットする" }).click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();

  await page.goto("/mypage");
  await expect(mypageAnswerLocator(page, FIRST_CHOICE_QUESTION_ORDER).getByText(FIRST_CHOICE_OPTION_1)).toHaveCount(0);
  await expect(page.getByText("未回答").first()).toBeVisible();
});

test("確認ダイアログはキャンセルでき、その場合は削除されない", async ({ page }) => {
  await startInterview(page);
  await answerInterviewRange(page, 1, ANSWER_THROUGH);

  await page.goto("/settings");
  await page.getByRole("button", { name: "デモをリセット" }).click();
  const dialog = page.getByRole("dialog", { name: "デモをリセット" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/mypage");
  await expect(mypageAnswerLocator(page, FIRST_CHOICE_QUESTION_ORDER).getByText(FIRST_CHOICE_OPTION_1)).toBeVisible();
});

test("会話・レポートが揃い1人を承諾した状態でもリセットでき、マッチ結果やお知らせも残らない", async ({ page }) => {
  // インタビューを最後まで回答し、アバター要約を作り、3人分の会話とレポートが揃った
  // 状態(=本番の不具合が起きた状態)を作ってからリセットする。
  // reachFirstUndecidedReportは内部でcompleteInterview→createAvatarSummary→
  // 全候補との会話完了→マッチ結果一覧→未決定の1件のレポート、まで進める
  // (tests/e2e/support/matching.ts)。
  await reachFirstUndecidedReport(page);

  // decisionsに行がある状態(1人を承諾)でもリセットできることを確認する
  // (このリセット経路も従来は未検証だった)。
  await page.getByRole("button", { name: "承諾する" }).click();
  await page.getByRole("button", { name: "承諾を確定する" }).click();
  await expect(page).toHaveURL(/\/reveal$/);

  await page.goto("/settings");
  await page.getByRole("button", { name: "デモをリセット" }).click();

  const dialog = page.getByRole("dialog", { name: "デモをリセット" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("この操作は取り消せません")).toBeVisible();

  await dialog.getByRole("button", { name: "リセットする" }).click();
  await expect(page).toHaveURL(/\/start$/);
  await expect(page.getByRole("button", { name: "インタビューをはじめる" })).toBeVisible();

  // 以前の回答が残っていない
  await page.goto("/mypage");
  await expect(mypageAnswerLocator(page, FIRST_CHOICE_QUESTION_ORDER).getByText(FIRST_CHOICE_OPTION_1)).toHaveCount(0);
  await expect(page.getByText("未回答").first()).toBeVisible();

  // 以前のマッチ結果が残っていない。リセット後は未回答なので最初の質問へ戻る。
  await page.goto("/matches");
  await expect(page).toHaveURL(/\/interview\/1$/);

  // 以前のお知らせが残っていない
  await page.goto("/notifications");
  await expect(page.getByRole("heading", { name: "お知らせ" })).toBeVisible();
  await expect(page.getByText("まだお知らせはありません。")).toBeVisible();
});
