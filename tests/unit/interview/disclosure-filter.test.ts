import { describe, expect, it } from "vitest";

import {
  CONSENT_QUESTION_CODE_BY_GROUP,
  filterDisclosableAnswers,
  isDisclosureConsentGiven,
  SENSITIVE_QUESTION_GROUPS,
  type InterviewQuestionCode,
  type SensitiveGroup,
} from "@/features/interview/domain";

// デリケートな回答をAIへ渡す前に除外するfilterDisclosableAnswersの単体テスト。
// この機能の核心なので、4通りの組み合わせ(本人×相手の開示意思)を必ず検証する。

const NON_SENSITIVE_CODE: InterviewQuestionCode = "q01"; // 休日・趣味。sensitiveGroupを持たない。
const INCOME_CODE: InterviewQuestionCode = "q28"; // 年収。sensitiveGroup: "income"。
const CONSENT_CODE: InterviewQuestionCode = "q38"; // 年収の開示意思そのもの。

function buildAnswers() {
  return [
    { questionCode: NON_SENSITIVE_CODE, answer: "外へ出かける" },
    { questionCode: INCOME_CODE, answer: "〜400万円" },
    { questionCode: CONSENT_CODE, answer: "アバター同士の会話で触れてよい" },
  ];
}

describe("filterDisclosableAnswers", () => {
  it("双方が開示OKならデリケートな回答が入力に含まれる", () => {
    const result = filterDisclosableAnswers(
      buildAnswers(),
      new Set<SensitiveGroup>(["income"]),
      new Set<SensitiveGroup>(["income"]),
    );
    expect(result.map((a) => a.questionCode)).toContain(INCOME_CODE);
  });

  it("本人OK・相手NGなら含まれない", () => {
    const result = filterDisclosableAnswers(
      buildAnswers(),
      new Set<SensitiveGroup>(["income"]),
      new Set<SensitiveGroup>(),
    );
    expect(result.map((a) => a.questionCode)).not.toContain(INCOME_CODE);
  });

  it("本人NG・相手OKなら含まれない", () => {
    const result = filterDisclosableAnswers(
      buildAnswers(),
      new Set<SensitiveGroup>(),
      new Set<SensitiveGroup>(["income"]),
    );
    expect(result.map((a) => a.questionCode)).not.toContain(INCOME_CODE);
  });

  it("双方NGなら含まれない", () => {
    const result = filterDisclosableAnswers(
      buildAnswers(),
      new Set<SensitiveGroup>(),
      new Set<SensitiveGroup>(),
    );
    expect(result.map((a) => a.questionCode)).not.toContain(INCOME_CODE);
  });

  it("デリケートでない回答は、同意の組み合わせによらず常に含まれる", () => {
    const combinations: Array<[ReadonlySet<SensitiveGroup>, ReadonlySet<SensitiveGroup>]> = [
      [new Set(["income"]), new Set(["income"])],
      [new Set(["income"]), new Set()],
      [new Set(), new Set(["income"])],
      [new Set(), new Set()],
    ];
    for (const [self, counterpart] of combinations) {
      const result = filterDisclosableAnswers(buildAnswers(), self, counterpart);
      expect(result.map((a) => a.questionCode)).toContain(NON_SENSITIVE_CODE);
    }
  });

  it("開示意思の質問自体(q38〜q41)は、同意状況によらず常に除外する", () => {
    const result = filterDisclosableAnswers(
      buildAnswers(),
      new Set<SensitiveGroup>(["income"]),
      new Set<SensitiveGroup>(["income"]),
    );
    expect(result.map((a) => a.questionCode)).not.toContain(CONSENT_CODE);
  });

  it("デリケートな4グループすべてで開示可否が正しく機能する", () => {
    for (const group of SENSITIVE_QUESTION_GROUPS.values()) {
      const codeForGroup = [...SENSITIVE_QUESTION_GROUPS.entries()]
        .find(([, g]) => g === group)![0];
      const answers = [{ questionCode: codeForGroup, answer: "何らかの回答" }];

      expect(
        filterDisclosableAnswers(answers, new Set([group]), new Set([group])).length,
      ).toBe(1);
      expect(
        filterDisclosableAnswers(answers, new Set(), new Set([group])).length,
      ).toBe(0);
    }
  });
});

describe("isDisclosureConsentGiven", () => {
  it("「アバター同士の会話で触れてよい」だけを同意ありと判定する", () => {
    expect(isDisclosureConsentGiven("アバター同士の会話で触れてよい")).toBe(true);
    expect(isDisclosureConsentGiven("会ってから自分で話したい")).toBe(false);
    expect(isDisclosureConsentGiven("")).toBe(false);
  });
});

describe("開示グループとデリケートな質問の対応", () => {
  it("仕様どおりの質問だけがsensitiveGroupを持つ", () => {
    const sensitiveCodes = [...SENSITIVE_QUESTION_GROUPS.keys()].sort();
    expect(sensitiveCodes).toEqual(["q24", "q25", "q26", "q27", "q28", "q31", "q32"]);
  });

  it("4つの開示グループそれぞれに対応する開示意思の質問がある", () => {
    expect(CONSENT_QUESTION_CODE_BY_GROUP.get("income")).toBe("q38");
    expect(CONSENT_QUESTION_CODE_BY_GROUP.get("career_education")).toBe("q39");
    expect(CONSENT_QUESTION_CODE_BY_GROUP.get("appearance")).toBe("q40");
    expect(CONSENT_QUESTION_CODE_BY_GROUP.get("family_marital")).toBe("q41");
  });
});
