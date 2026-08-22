import { describe, expect, it } from "vitest";

import { INTERVIEW_QUESTIONS, TOTAL_QUESTIONS } from "@/features/interview/domain";

// domain.ts単体での質問定義の整合性を検証する。
// SQLとの突き合わせは sql-contract.test.ts が担当する。
describe("質問定義の整合性", () => {
  it("質問コードに重複がない", () => {
    const codes = INTERVIEW_QUESTIONS.map(({ code }) => code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("表示順(displayOrder)は1からTOTAL_QUESTIONSまでの連番で重複しない", () => {
    const orders = INTERVIEW_QUESTIONS.map(({ displayOrder }) => displayOrder).slice().sort((a, b) => a - b);
    expect(orders).toEqual(Array.from({ length: TOTAL_QUESTIONS }, (_unused, index) => index + 1));
  });

  it("TOTAL_QUESTIONSはINTERVIEW_QUESTIONSの件数と一致する(41問)", () => {
    expect(TOTAL_QUESTIONS).toBe(41);
    expect(INTERVIEW_QUESTIONS).toHaveLength(TOTAL_QUESTIONS);
  });

  it("choiceの選択肢は2〜12個(DBのjsonb_array_length制約と一致)", () => {
    for (const question of INTERVIEW_QUESTIONS) {
      if (question.kind !== "choice") continue;
      expect(question.choices.length).toBeGreaterThanOrEqual(2);
      expect(question.choices.length).toBeLessThanOrEqual(12);
      // 選択肢自体にも重複がないこと。
      expect(new Set(question.choices).size).toBe(question.choices.length);
    }
  });

  it("free_textの質問は選択肢を持たない", () => {
    for (const question of INTERVIEW_QUESTIONS) {
      if (question.kind !== "free_text") continue;
      expect(question.choices).toHaveLength(0);
      expect(question.minLength).toBe(1);
      expect(question.maxLength).toBe(500);
    }
  });

  it("質問コードはq+2桁数字の形式で、q01〜q41の範囲に収まる", () => {
    for (const { code } of INTERVIEW_QUESTIONS) {
      expect(code).toMatch(/^q(?:0[1-9]|[123][0-9]|4[01])$/);
    }
  });

  it("free_textにしない設計方針: 職業・年収など基本プロフィールはすべてchoice", () => {
    // src/lib/ai/privacy-provider.tsのredactSelfDisclosedIdentityが自由記述から
    // 「会社」「勤務先」「所属」「部署」等を含む文を除去するため、
    // 職業・年収などを自由記述にすると回答が消える。基本プロフィール17問(q21〜q37)は
    // すべてchoiceであることを固定する。
    const profileQuestions = INTERVIEW_QUESTIONS.filter(({ code }) =>
      Number(code.slice(1)) >= 21 && Number(code.slice(1)) <= 37,
    );
    expect(profileQuestions).toHaveLength(17);
    expect(profileQuestions.every(({ kind }) => kind === "choice")).toBe(true);
  });
});
