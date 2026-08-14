import { describe, expect, it } from "vitest";

import {
  findFirstUnansweredOrder,
  getAllowedInterviewOrder,
  INTERVIEW_QUESTIONS,
} from "@/features/interview/domain";
import { parseInterviewAnswer } from "@/features/interview/schemas";

describe("固定インタビュー質問", () => {
  it("q01〜q20を表示順どおり、選択15問・自由記述5問で保持する", () => {
    expect(INTERVIEW_QUESTIONS).toHaveLength(20);
    expect(INTERVIEW_QUESTIONS.map(({ code }) => code)).toEqual(
      Array.from({ length: 20 }, (_, index) => `q${String(index + 1).padStart(2, "0")}`),
    );
    expect(INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "choice")).toHaveLength(15);
    expect(INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "free_text")).toHaveLength(5);
    expect(INTERVIEW_QUESTIONS[0]?.prompt).toBe("休日の過ごし方に最も近いのは？");
    expect(INTERVIEW_QUESTIONS[19]?.prompt).toBe(
      "相手に、これだけは知っておいてほしいことは？",
    );
  });

  it("選択式は仕様にある選択肢だけを受理する", () => {
    const question = INTERVIEW_QUESTIONS[0];
    expect(question).toBeDefined();
    expect(parseInterviewAnswer(question!, "外へ出かける")).toBe("外へ出かける");
    expect(() => parseInterviewAnswer(question!, "どちらでもない")).toThrow(
      "選択肢から回答してください",
    );
  });

  it("自由記述は空白を除いて1〜500文字を受理する", () => {
    const question = INTERVIEW_QUESTIONS[19];
    expect(question).toBeDefined();
    expect(parseInterviewAnswer(question!, "  大切にしていること  ")).toBe(
      "大切にしていること",
    );
    expect(() => parseInterviewAnswer(question!, "   ")).toThrow("1文字以上");
    expect(() => parseInterviewAnswer(question!, "\t\n\u00a0\u3000")).toThrow("1文字以上");
    expect(parseInterviewAnswer(question!, "あ".repeat(500))).toHaveLength(500);
    expect(() => parseInterviewAnswer(question!, "あ".repeat(501))).toThrow("500文字以内");
  });
});

describe("回答順序", () => {
  it("回答済み件数ではなく最初の未回答orderを返す", () => {
    expect(findFirstUnansweredOrder(INTERVIEW_QUESTIONS, [
      { questionCode: "q01", answer: "外へ出かける", revision: 1 },
      { questionCode: "q03", answer: "早めに決めたい", revision: 1 },
    ])).toBe(2);
  });

  it("未回答への飛び越しは戻し、既存回答のrevision修正は許可する", () => {
    const answers = [{ questionCode: "q01" as const, answer: "外へ出かける", revision: 1 }];
    expect(getAllowedInterviewOrder(3, INTERVIEW_QUESTIONS, answers)).toBe(2);
    expect(getAllowedInterviewOrder(3, INTERVIEW_QUESTIONS, [
      ...answers,
      { questionCode: "q03", answer: "早めに決めたい", revision: 1 },
    ])).toBe(3);
  });
});
