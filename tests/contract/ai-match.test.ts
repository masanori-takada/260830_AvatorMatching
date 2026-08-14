import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { matchOutputSchema } from "@/lib/ai/schemas";

describe("AI match契約", () => {
  it("answerRefsをZod・JSON Schema・DBの全境界で1件以上に限定する", () => {
    const jsonContract = JSON.parse(readFileSync(resolve(
      process.cwd(), "specs/001-avatar-matching-pilot/contracts/ai-match.schema.json",
    ), "utf8"));
    const migration = readFileSync(resolve(
      process.cwd(), "supabase/migrations/202608130003_matching.sql",
    ), "utf8");

    expect(jsonContract.properties.messages.items.properties.answerRefs.minItems).toBe(1);
    expect(() => matchOutputSchema.parse({ messages: [], report: {} })).toThrow();
    expect(migration).toMatch(/jsonb_array_length\(message -> 'answerRefs'\) < 1/i);
  });

  it("重複軸と存在しない引用turnを拒否する", () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      turnIndex: index + 1,
      speaker: index % 2 === 0 ? "user_avatar" as const : "candidate_avatar" as const,
      body: `発言${index + 1}`,
      answerRefs: [`q0${index % 3 + 1}`],
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
      messages: base.messages.map((message, index) => index === 0
        ? { ...message, answerRefs: [] }
        : message),
    })).toThrow();
    expect(() => matchOutputSchema.parse({
      ...base,
      report: { ...base.report, dimensions: base.report.dimensions.map((item) => ({ ...item, axis: "conversation_flow" })) },
    })).toThrow();
    expect(() => matchOutputSchema.parse({
      ...base,
      report: { ...base.report, dimensions: base.report.dimensions.map((item, index) => index === 0 ? { ...item, evidenceTurnIndex: 99 } : item) },
    })).toThrow();
    expect(() => matchOutputSchema.parse({
      ...base,
      messages: base.messages.map((message, index) => index === 0
        ? { ...message, body: "連絡先は user@example.com" }
        : message),
    })).toThrow("識別情報");
  });
});
