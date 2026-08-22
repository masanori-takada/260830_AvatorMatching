import { describe, expect, it } from "vitest";

import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import { getOwnedMatchInput } from "@/features/matching/server/queries";

// getOwnedMatchInputは、AIへ渡す直前にデリケートな回答を開示同意に基づいて除外する。
// (src/features/interview/domain.tsのfilterDisclosableAnswersに判定を一元化している。)

type Row = { question_code: string; answer: string; revision: number };

// TOTAL_QUESTIONS件そろっていないとINTERVIEW_INCOMPLETEになるため、ダミー回答で埋める。
// q28(年収)とq38(年収の開示意思=OK)だけ意味のある値にする。
function buildAnswers(overrides: Record<string, string> = {}): Row[] {
  return Array.from({ length: TOTAL_QUESTIONS }, (_unused, index) => {
    const code = `q${String(index + 1).padStart(2, "0")}`;
    const defaultAnswer = code === "q28" ? "〜400万円"
      : code === "q38" ? "アバター同士の会話で触れてよい"
      : "ダミー回答";
    return { question_code: code, answer: overrides[code] ?? defaultAnswer, revision: 1 };
  });
}

function clientWith(answers: Row[], candidateConsentGroups: string[]) {
  const single = (data: unknown) => ({ single: () => Promise.resolve({ data, error: null }) });
  const from = (table: string) => {
    if (table === "match_runs") {
      return { select: () => ({ eq: () => ({ eq: () => single({ candidate_id: "candidate-1" }) }) }) };
    }
    if (table === "interview_answers") {
      return { select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: answers, error: null }) }) }) };
    }
    if (table === "avatar_profiles") {
      return { select: () => ({ eq: () => single({ summary: "要約", traits: {} }) }) };
    }
    if (table === "demo_candidates") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => single({
              avatar_alias: "ルナ",
              conversation_profile: {},
              disclosure_consent_groups: candidateConsentGroups,
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  };
  return { from } as unknown as Parameters<typeof getOwnedMatchInput>[0];
}

describe("getOwnedMatchInput", () => {
  it("本人・相手ともにincomeへ同意していればq28を含む", async () => {
    const client = clientWith(buildAnswers(), ["income"]);
    const input = await getOwnedMatchInput(client, "run-1", "owner-1");
    expect(input.answers.map((a) => a.questionCode)).toContain("q28");
  });

  it("相手がincomeへ同意していなければq28を含まない", async () => {
    const client = clientWith(buildAnswers(), []);
    const input = await getOwnedMatchInput(client, "run-1", "owner-1");
    expect(input.answers.map((a) => a.questionCode)).not.toContain("q28");
  });

  it("本人がincomeへ同意していなければ(NG回答)、相手が同意していてもq28を含まない", async () => {
    const client = clientWith(buildAnswers({ q38: "会ってから自分で話したい" }), ["income"]);
    const input = await getOwnedMatchInput(client, "run-1", "owner-1");
    expect(input.answers.map((a) => a.questionCode)).not.toContain("q28");
  });

  it("双方が同意していなければq28を含まない", async () => {
    const client = clientWith(buildAnswers({ q38: "会ってから自分で話したい" }), []);
    const input = await getOwnedMatchInput(client, "run-1", "owner-1");
    expect(input.answers.map((a) => a.questionCode)).not.toContain("q28");
  });

  it("開示意思の質問(q38)自体はAIへの入力に含めない", async () => {
    const client = clientWith(buildAnswers(), ["income"]);
    const input = await getOwnedMatchInput(client, "run-1", "owner-1");
    expect(input.answers.map((a) => a.questionCode)).not.toContain("q38");
  });

  it("デリケートでない回答は同意状況によらず常に含む", async () => {
    const client = clientWith(buildAnswers(), []);
    const input = await getOwnedMatchInput(client, "run-1", "owner-1");
    expect(input.answers.map((a) => a.questionCode)).toContain("q01");
  });
});
