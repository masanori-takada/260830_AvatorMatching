import { describe, expect, it, vi } from "vitest";

import { PrivacySafeAiProvider } from "@/lib/ai/privacy-provider";
import type { AiProvider, MatchInput, ProfileInput } from "@/lib/ai/types";

const answers: ProfileInput["answers"] = Array.from({ length: 20 }, (_, index) => ({
  questionCode: `q${String(index + 1).padStart(2, "0")}` as `q${string}`,
  answer: `選択回答${index + 1}`,
  revision: 1,
}));

for (const [code, value] of [
  ["q04", "山田太郎です"],
  ["q08", "山 田・太 郎です"],
  ["q12", "user@example.com"],
  ["q18", "090-1234-5678"],
  ["q20", "東京都で働いています"],
] as const) {
  answers[Number(code.slice(1)) - 1]!.answer = value;
}

const safeProfile = {
  summary: "選択回答1・選択回答2・選択回答3を反映した要約です。",
  traits: {
    leisure: "選択回答1", communication: "選択回答2", lifestyle: "選択回答3",
    values: "対話", relationships: "協調", priorities: "安心",
  },
};

function providerWith(summary = safeProfile.summary, matchBody?: string): AiProvider {
  return {
    providerId: "spy-v1",
    generateProfile: vi.fn().mockResolvedValue({ ...safeProfile, summary }),
    generateMatch: vi.fn().mockResolvedValue({
      messages: Array.from({ length: 8 }, (_, index) => ({
        turnIndex: index + 1,
        speaker: index % 2 === 0 ? "user_avatar" as const : "candidate_avatar" as const,
        body: index === 0 && matchBody
          ? matchBody
          : index < 3 ? `選択回答${index + 1}` : `安全な発言${index + 1}`,
        answerRefs: index < 3 ? [`q0${index + 1}`] : [],
      })),
      report: {
        overallScore: 70, summary: "安全な要約", caution: "安全に対話してください。",
        dimensions: ["conversation_flow", "values_alignment", "humor_fit", "mutual_interest", "mismatch_severity"].map((axis, index) => ({
          axis, score: 70, explanation: "安全な根拠", evidenceTurnIndex: index + 1,
        })),
      },
    }),
  } as AiProvider;
}

describe("PrivacySafeAiProvider", () => {
  it("profileとmatchのProvider入力から自由記述rawを除きchoiceは保持する", async () => {
    const inner = providerWith();
    const provider = new PrivacySafeAiProvider(inner);
    const profileInput = { answers };
    const matchInput: MatchInput = {
      answers,
      profile: safeProfile,
      candidate: { avatarAlias: "ルナ", conversationProfile: {} },
    };

    const profile = await provider.generateProfile(profileInput);
    const match = await provider.generateMatch(matchInput);

    for (const call of [
      vi.mocked(inner.generateProfile).mock.calls[0]![0],
      vi.mocked(inner.generateMatch).mock.calls[0]![0],
    ]) {
      const serialized = JSON.stringify(call);
      expect(serialized).toContain("選択回答1");
      expect(serialized).toContain("選択回答2");
      expect(serialized).toContain("選択回答3");
      expect(serialized).not.toContain("山田太郎");
      expect(serialized).not.toContain("user@example.com");
      expect(serialized).not.toContain("090-1234-5678");
    }
    expect(JSON.stringify({ profile, match })).not.toMatch(/山田太郎|user@example\.com|090-1234-5678/u);
  });

  it.each(["山田太郎です", "山 田・太 郎です", "user@example.com", "090-1234-5678"])(
    "元の自由記述由来の識別断片をProvider出力に含めたら拒否する: %s",
    async (leaked) => {
      const provider = new PrivacySafeAiProvider(providerWith(`要約: ${leaked}`));
      await expect(provider.generateProfile({ answers })).rejects.toThrow();
    },
  );

  it("match出力に元の自由記述由来の識別断片を含めたら拒否する", async () => {
    const provider = new PrivacySafeAiProvider(providerWith(undefined, "山 田・太 郎さんの話"));
    await expect(provider.generateMatch({
      answers,
      profile: safeProfile,
      candidate: { avatarAlias: "ルナ", conversationProfile: {} },
    })).rejects.toThrow("自由記述由来の識別情報");
  });
});
