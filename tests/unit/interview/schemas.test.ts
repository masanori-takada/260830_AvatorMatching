import { describe, expect, it } from "vitest";

import {
  findFirstUnansweredOrder,
  findInterviewQuestion,
  getAllowedInterviewOrder,
  INTERVIEW_QUESTIONS,
  TOTAL_QUESTIONS,
} from "@/features/interview/domain";
import { parseInterviewAnswer } from "@/features/interview/schemas";

// q01は表示順22に、q20は表示順41に移動している(コードは変更しない設計方針)。
// displayOrderの先頭(1)は基本プロフィールのq21(性別)。
const firstDisplayedQuestion = findInterviewQuestion("q21");
const lastDisplayedQuestion = findInterviewQuestion("q20");

describe("固定インタビュー質問", () => {
  it("全41問を、表示順どおり、選択36問・自由記述5問で保持する", () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(41);
    expect(TOTAL_QUESTIONS).toBe(41);
    expect(INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "choice")).toHaveLength(36);
    expect(INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "free_text")).toHaveLength(5);
    expect(firstDisplayedQuestion?.displayOrder).toBe(1);
    expect(firstDisplayedQuestion?.prompt).toBe("性別を教えてください");
    expect(lastDisplayedQuestion?.displayOrder).toBe(41);
    expect(lastDisplayedQuestion?.prompt).toBe(
      "相手に、これだけは知っておいてほしいことは？",
    );
  });

  it("選択式は仕様にある選択肢だけを受理する", () => {
    const question = firstDisplayedQuestion;
    expect(question).toBeDefined();
    expect(parseInterviewAnswer(question!, "男性")).toBe("男性");
    expect(() => parseInterviewAnswer(question!, "どちらでもない")).toThrow(
      "選択肢から回答してください",
    );
  });

  it("自由記述は空白を除いて1〜500文字を受理する", () => {
    const question = lastDisplayedQuestion;
    expect(question).toBeDefined();
    expect(parseInterviewAnswer(question!, "  大切にしていること  ")).toBe(
      "大切にしていること",
    );
    expect(() => parseInterviewAnswer(question!, "   ")).toThrow("1文字以上");
    expect(() => parseInterviewAnswer(question!, "\t\n 　")).toThrow("1文字以上");
    expect(parseInterviewAnswer(question!, "あ".repeat(500))).toHaveLength(500);
    expect(() => parseInterviewAnswer(question!, "あ".repeat(501))).toThrow("500文字以内");
  });
});

describe("回答順序", () => {
  it("回答済み件数ではなく最初の未回答orderを返す", () => {
    // displayOrder 1=q21, 2=q22, 3=q23。q21とq23だけ回答済みならq22(2)が次。
    expect(findFirstUnansweredOrder(INTERVIEW_QUESTIONS, [
      { questionCode: "q21", answer: "男性", revision: 1 },
      { questionCode: "q23", answer: "関東", revision: 1 },
    ])).toBe(2);
  });

  it("未回答への飛び越しは戻し、既存回答のrevision修正は許可する", () => {
    const answers = [{ questionCode: "q21" as const, answer: "男性", revision: 1 }];
    expect(getAllowedInterviewOrder(3, INTERVIEW_QUESTIONS, answers)).toBe(2);
    expect(getAllowedInterviewOrder(3, INTERVIEW_QUESTIONS, [
      ...answers,
      { questionCode: "q23", answer: "関東", revision: 1 },
    ])).toBe(3);
  });
});
