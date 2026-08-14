import { describe, expect, it } from "vitest";

import { getAiProvider } from "@/lib/ai/provider";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import type { ProfileInput } from "@/lib/ai/types";

const answers: ProfileInput["answers"] = Array.from({ length: 20 }, (_, index) => ({
  questionCode: `q${String(index + 1).padStart(2, "0")}` as `q${string}`,
  answer: `回答${index + 1}`,
  revision: 1,
}));
answers[0]!.answer = "外へ出かける";
answers[1]!.answer = "親しい人と少人数";
answers[3]!.answer = "読書に夢中です user@example.com";

describe("MockAiProvider", () => {
  it("同じ20回答から同じプロフィールを生成し3回答以上を反映する", async () => {
    const provider = new MockAiProvider();
    const first = await provider.generateProfile({ answers });
    const second = await provider.generateProfile({ answers });

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toContain("q01");
    expect(JSON.stringify(first)).toContain("q02");
    expect(JSON.stringify(first)).toContain("q03");
    expect(Object.keys(first.traits)).toHaveLength(6);
    expect(first).not.toHaveProperty("fullName");
    expect(first).not.toHaveProperty("company");
    expect(first).not.toHaveProperty("department");
  });

  it("matchは8発言以上、3回答以上の参照、重複しない5軸と引用根拠を返す", async () => {
    const provider = new MockAiProvider();
    const profile = await provider.generateProfile({ answers });
    const match = await provider.generateMatch({
      answers,
      profile,
      candidate: { avatarAlias: "ルナ", conversationProfile: { interests: ["読書"] } },
    });

    expect(match.messages.length).toBeGreaterThanOrEqual(8);
    expect(new Set(match.messages.flatMap(({ answerRefs }) => answerRefs)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(match.report.dimensions.map(({ axis }) => axis)).size).toBe(5);
    const turns = new Set(match.messages.map(({ turnIndex }) => turnIndex));
    expect(match.report.dimensions.every(({ evidenceTurnIndex }) => turns.has(evidenceTurnIndex))).toBe(true);
    const output = JSON.stringify(match);
    expect(output).toContain("外へ出かける");
    expect(output).toContain("親しい人と少人数");
    expect(output).toContain("読書に夢中です");
    expect(output).not.toContain("user@example.com");
  });

  it("未対応provider名はfail-closedに拒否する", () => {
    expect(() => getAiProvider("bedrock" as string)).toThrow("未対応のAI provider");
  });

  it("保存用の安定したproviderIdを公開する", () => {
    expect(new MockAiProvider().providerId).toBe("mock-v1");
  });
});
