import { describe, expect, it } from "vitest";

import { matchOutputSchema } from "@/lib/ai/schemas";

describe("AI match契約", () => {
  it("重複軸と存在しない引用turnを拒否する", () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      turnIndex: index + 1,
      speaker: index % 2 === 0 ? "user_avatar" as const : "candidate_avatar" as const,
      body: `発言${index + 1}`,
      answerRefs: index < 3 ? [`q0${index + 1}`] : [],
    }));
    const dimension = (axis: string, evidenceTurnIndex = 1) => ({
      axis, score: 70, explanation: "会話中の発言を根拠に評価", evidenceTurnIndex,
    });
    const base = {
      messages,
      report: {
        overallScore: 70, summary: "相性要約", caution: "違いも対話で確認",
        dimensions: [
          dimension("conversation_flow"), dimension("values_alignment", 2),
          dimension("humor_fit", 3), dimension("mutual_interest", 4),
          dimension("mismatch_severity", 5),
        ],
      },
    };
    expect(matchOutputSchema.parse(base)).toEqual(base);
    expect(() => matchOutputSchema.parse({
      ...base,
      report: { ...base.report, dimensions: base.report.dimensions.map((item) => ({ ...item, axis: "conversation_flow" })) },
    })).toThrow();
    expect(() => matchOutputSchema.parse({
      ...base,
      report: { ...base.report, dimensions: base.report.dimensions.map((item, index) => index === 0 ? { ...item, evidenceTurnIndex: 99 } : item) },
    })).toThrow();
  });
});
