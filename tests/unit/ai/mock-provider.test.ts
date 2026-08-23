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
answers[2]!.answer = "早めに決めたい";
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
      candidate: { conversationProfile: { interests: ["読書"] } },
    });

    expect(match.messages.length).toBeGreaterThanOrEqual(8);
    expect(match.messages.every(({ answerRefs }) => answerRefs.length >= 1)).toBe(true);
    expect(new Set(match.messages.flatMap(({ answerRefs }) => answerRefs)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(match.report.dimensions.map(({ axis }) => axis)).size).toBe(5);
    const turns = new Set(match.messages.map(({ turnIndex }) => turnIndex));
    expect(match.report.dimensions.every(({ evidenceTurnIndex }) => turns.has(evidenceTurnIndex))).toBe(true);
    const output = JSON.stringify(match);
    expect(output).toContain("外へ出かける");
    expect(output).toContain("親しい人と少人数");
    expect(output).toContain("早めに決めたい");
    expect(output).not.toContain("読書に夢中です");
    expect(output).not.toContain("user@example.com");
  });

  it("承認前の会話・総評・注意・5軸説明に候補の具体名を出力しない", async () => {
    const match = await new MockAiProvider().generateMatch({
      answers,
      candidate: { conversationProfile: { introduction: "陽翔はキャンプが好きです" } },
    });
    const serialized = JSON.stringify(match);

    expect(serialized).not.toMatch(/ルナ|陽翔|紬|蒼太|隼人|芽衣/u);
    expect(serialized).toMatch(/候補アバター|お相手/u);
  });

  it("実際に渡した回答コード(q01〜q03)だけをanswerRefsで参照する(開示同意の仕組みを損なわない)", async () => {
    const provider = new MockAiProvider();
    const profile = await provider.generateProfile({ answers });
    const match = await provider.generateMatch({
      answers,
      profile,
      candidate: { conversationProfile: { interests: ["読書"] } },
    });

    const referencedCodes = new Set(match.messages.flatMap(({ answerRefs }) => answerRefs));
    for (const code of referencedCodes) {
      expect(answers.some((answer) => answer.questionCode === code)).toBe(true);
    }
  });

  it("渡していない回答コードを参照する出力になっていれば、生成時に検出して拒否する", async () => {
    const provider = new MockAiProvider();
    const profile = await provider.generateProfile({ answers });
    // q01〜q03を渡さない(開示NGで除外された想定)。モックは常にq01〜q03を参照するため、
    // この場合は「渡していないコードを参照した」契約違反として拒否されるはずである。
    const withoutQ01ToQ03 = answers.filter((answer) => !["q01", "q02", "q03"].includes(answer.questionCode));

    await expect(provider.generateMatch({
      answers: withoutQ01ToQ03,
      profile,
      candidate: { conversationProfile: { interests: ["読書"] } },
    })).rejects.toThrow("AIへ渡していない質問コード");
  });

  it("未対応provider名はfail-closedに拒否する", () => {
    expect(() => getAiProvider("bedrock" as string)).toThrow("未対応のAI provider");
  });

  it("保存用の安定したproviderIdを公開する", () => {
    expect(new MockAiProvider().providerId).toBe("mock-v1");
  });
});
