import { describe, expect, it } from "vitest";

import {
  findFirstUnansweredOrder,
  findInterviewQuestion,
  getAllowedInterviewOrder,
  INTERVIEW_QUESTIONS,
  TOTAL_QUESTIONS,
} from "@/features/interview/domain";
import { parseInterviewAnswer } from "@/features/interview/schemas";

// q01は表示順23に、q20は表示順42に移動している(コードは変更しない設計方針)。
// displayOrderの先頭(1)は基本プロフィールのq21(性別)、2番目(2)は相手に紹介してほしい性別のq42。
const firstDisplayedQuestion = findInterviewQuestion("q21");
const lastDisplayedQuestion = findInterviewQuestion("q20");

describe("固定インタビュー質問", () => {
  it("全42問を、表示順どおり、選択37問・自由記述5問で保持する", () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(42);
    expect(TOTAL_QUESTIONS).toBe(42);
    expect(INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "choice")).toHaveLength(37);
    expect(INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "free_text")).toHaveLength(5);
    expect(firstDisplayedQuestion?.displayOrder).toBe(1);
    expect(firstDisplayedQuestion?.prompt).toBe("性別を教えてください");
    expect(lastDisplayedQuestion?.displayOrder).toBe(42);
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
    // displayOrder 1=q21, 2=q42, 3=q22, 4=q23。q21とq23だけ回答済みでもq42(2)が次(未回答の先頭)。
    expect(findFirstUnansweredOrder(INTERVIEW_QUESTIONS, [
      { questionCode: "q21", answer: "男性", revision: 1 },
      { questionCode: "q23", answer: "関東", revision: 1 },
    ])).toBe(2);
  });

  it("未回答への飛び越しは戻し、既存回答のrevision修正は許可する", () => {
    // displayOrder 1=q21, 2=q42, 3=q22, 4=q23。q21だけ回答済みならfirstUnanswered=2(q42)。
    const answers = [{ questionCode: "q21" as const, answer: "男性", revision: 1 }];
    expect(getAllowedInterviewOrder(4, INTERVIEW_QUESTIONS, answers)).toBe(2);
    // 要求先(order4=q23)に既存回答があれば、firstUnansweredより先でも戻さない。
    expect(getAllowedInterviewOrder(4, INTERVIEW_QUESTIONS, [
      ...answers,
      { questionCode: "q23", answer: "関東", revision: 1 },
    ])).toBe(4);
  });
});
