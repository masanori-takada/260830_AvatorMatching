import { expect, type Locator, type Page } from "@playwright/test";

import { INTERVIEW_QUESTIONS, TOTAL_QUESTIONS } from "@/features/interview/domain";

/**
 * 全設問数。`src/features/interview/domain.ts` が唯一の定義元であり、
 * ここでは再定義せずそこから導出する(質問構成が変わってもズレない)。
 */
export const TOTAL_INTERVIEW_QUESTIONS = TOTAL_QUESTIONS;

/**
 * 表示順(displayOrder)昇順に並べた質問一覧。
 * `INTERVIEW_QUESTIONS` の宣言順は表示順と一致している前提だが、
 * それに依存せず明示的にソートして導出する。
 */
const QUESTIONS_BY_DISPLAY_ORDER = [...INTERVIEW_QUESTIONS].sort(
  (left, right) => left.displayOrder - right.displayOrder,
);

/**
 * 質問の順番や内容が変わってもspec側を壊さないための導出値。
 *
 * 「1問目は選択式」「4問目は自由記述」のような具体的な表示順の前提を
 * spec側に直書きしないため、実際の質問定義(domain.ts)から機械的に導出する。
 * この導出ロジックは複数specで重複させず、ここに一元化すること。
 */
const firstChoiceQuestion = QUESTIONS_BY_DISPLAY_ORDER.find((question) => question.kind === "choice");
const firstFreeTextQuestion = QUESTIONS_BY_DISPLAY_ORDER.find((question) => question.kind === "free_text");

if (!firstChoiceQuestion) {
  throw new Error("選択式の質問が1つも見つかりません(domain.tsのINTERVIEW_QUESTIONSを確認してください)");
}
if (!firstFreeTextQuestion) {
  throw new Error("自由記述の質問が1つも見つかりません(domain.tsのINTERVIEW_QUESTIONSを確認してください)");
}
if (firstChoiceQuestion.choices.length < 2) {
  throw new Error("最初の選択式質問の選択肢が2つ未満です(1番目/2番目の選択肢を検証できません)");
}

/** 最初の選択式質問の表示順。 */
export const FIRST_CHOICE_QUESTION_ORDER = firstChoiceQuestion.displayOrder;
/** 最初の選択式質問の1番目の選択肢の文言。 */
export const FIRST_CHOICE_OPTION_1 = firstChoiceQuestion.choices[0]!;
/** 最初の選択式質問の2番目の選択肢の文言。 */
export const FIRST_CHOICE_OPTION_2 = firstChoiceQuestion.choices[1]!;
/** 最初の自由記述質問の表示順。 */
export const FIRST_FREE_TEXT_QUESTION_ORDER = firstFreeTextQuestion.displayOrder;

/**
 * 自由記述質問すべての表示順の一覧(表示順昇順)。
 * 「どの表示順が自由記述か」を各specで個別に列挙・ハードコードしないため、
 * domain.tsの質問定義から一元的に導出する。
 */
export const FREE_TEXT_QUESTION_ORDERS: readonly number[] = QUESTIONS_BY_DISPLAY_ORDER.filter(
  (question) => question.kind === "free_text",
).map((question) => question.displayOrder);

/**
 * マイページ上で、指定した表示順(displayOrder)の質問に対応する回答表示欄を指すロケータ。
 *
 * `src/components/interview/answer-list.tsx` は各回答欄(section)の `aria-labelledby` に
 * 質問文の要素を指定しており、質問文がその回答欄のアクセシブルネームになっている。そのため
 * `page.getByLabel(質問文)` で「その質問の回答欄」だけに絞り込める。
 *
 * 選択肢の文言は複数の質問で重複しうる(例:「男性」はq21「性別を教えてください」と
 * q42「どんな相手を紹介してほしいですか？」の両方に登場する)。マイページ上で特定の質問の
 * 回答を選択肢の文言だけで検証すると一意に特定できずstrict mode violationになるため、
 * その場合はこの関数で質問ごとに絞り込んでから `.getByText(...)` 等を使うこと。
 * 質問文はspecに直書きせずdomain.tsから導出するため、この導出ロジックを複数specに
 * 複製しないこと。
 */
export function mypageAnswerLocator(page: Page, order: number): Locator {
  const question = QUESTIONS_BY_DISPLAY_ORDER.find((candidate) => candidate.displayOrder === order);
  if (!question) {
    throw new Error(`表示順${order}の質問が見つかりません(domain.tsのINTERVIEW_QUESTIONSを確認してください)`);
  }
  return page.getByLabel(question.prompt);
}

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
 *
 * 自由記述かどうかは表示順の固定リストではなく、実際のDOM(「回答を入力」欄の有無)から
 * 判断する。表示順は質問の追加・並び替えでずれうるため、そのほうが壊れにくい。
 */
export async function answerInterviewQuestion(page: Page, order: number, text = `自由回答 ${order}`): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  const freeTextInput = page.getByLabel("回答を入力");
  if (await freeTextInput.isVisible().catch(() => false)) {
    await freeTextInput.fill(text);
    await page.getByRole("button", { name: "送信" }).click();
  } else {
    await page.getByRole("group", { name: "回答を選択" }).getByRole("button").first().click();
  }
}

/**
 * `from`〜`to` の設問へ順に回答する(1問ごとにURL到達を待ち合わせる)。
 * `from > to` の場合は何もしない(範囲が空になる呼び出しを許容する)。
 */
export async function answerInterviewRange(page: Page, from: number, to: number): Promise<void> {
  for (let order = from; order <= to; order += 1) {
    await answerInterviewQuestion(page, order);
  }
}

/**
 * 選択式の設問で、選択肢グループの`index`番目(0始まり)のボタンを選ぶ。
 * 回答済みの質問を別の選択肢へ修正するテストなど、特定の選択肢を明示的に
 * 選びたい場合に使う(通常の回答には`answerInterviewQuestion`を使うこと)。
 */
export async function selectInterviewChoice(page: Page, order: number, index: number): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  await page.getByRole("group", { name: "回答を選択" }).getByRole("button").nth(index).click();
}

/**
 * 選択式の設問を、キーボード操作(Tab→Enter)だけで送信する。
 * アクセシビリティ検証(キーボードのみでの操作)専用のヘルパー。
 */
export async function answerChoiceQuestionByKeyboard(page: Page, order: number): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  await page.keyboard.press("Tab");
  await expect(page.getByRole("group", { name: "回答を選択" }).getByRole("button").first()).toBeFocused();
  await page.keyboard.press("Enter");
}

/**
 * 自由記述の設問を、キーボード操作(入力→Tab→Enter)だけで送信する。
 * アクセシビリティ検証(キーボードのみでの操作)専用のヘルパー。
 */
export async function answerFreeTextQuestionByKeyboard(page: Page, order: number, text: string): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/interview/${order}(?:\\?.*)?$`));
  const textarea = page.getByLabel("回答を入力");
  await textarea.focus();
  await page.keyboard.type(text);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "送信" })).toBeFocused();
  await page.keyboard.press("Enter");
}

/**
 * インタビューを開始し、1問目から最終問(全問)まで回答して完了画面へ到達する。
 */
export async function completeInterview(page: Page): Promise<void> {
  await startInterview(page);
  await answerInterviewRange(page, 1, TOTAL_INTERVIEW_QUESTIONS);
  await expect(page).toHaveURL(/\/interview\/complete$/);
}
