import { describe, expect, it, vi } from "vitest";

import { extractSensitiveFragments, PrivacySafeAiProvider } from "@/lib/ai/privacy-provider";
import type { AiProvider, MatchInput, ProfileInput } from "@/lib/ai/types";

/** 漏洩検査と同じ正規化。断片が本文へ残っていないかを比較するために使う。 */
const normalizeForTest = (value: string) => value
  .normalize("NFKC")
  .toLocaleLowerCase("ja-JP")
  .replace(/[\p{White_Space}\p{P}\p{S}]/gu, "");

// 方針: 自由記述5問(q04, q08, q12, q18, q20)は内容を残し、識別情報だけを除去してProviderへ渡す。
// 入口(sanitizeAnswers)で識別情報を除去し、出口(assertNoPrivateAnswerLeak)で漏洩がないか二重防御する。

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
        answerRefs: [`q0${index % 3 + 1}`],
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
  describe("入口: sanitizeAnswers(自由記述の内容は残し、識別情報だけを除去する)", () => {
    it("選択式の回答はそのままProviderへ渡す", async () => {
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);

      await provider.generateProfile({ answers });

      const passed = vi.mocked(inner.generateProfile).mock.calls[0]![0].answers;
      expect(passed.find((a) => a.questionCode === "q01")!.answer).toBe("選択回答1");
      expect(passed.find((a) => a.questionCode === "q02")!.answer).toBe("選択回答2");
    });

    it("自由記述の内容(趣味・価値観などの本文)はProviderへそのまま届く", async () => {
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      privateAnswers[3]!.answer = "休日は読書とカフェ巡りをして過ごします。";
      privateAnswers[7]!.answer = "誠実な対話を大切にしています。";
      privateAnswers[11]!.answer = "将来はチームを支える役割を担いたいです。";
      privateAnswers[17]!.answer = "人との約束は必ず守るようにしています。";
      privateAnswers[19]!.answer = "新しい場所を訪れることが好きです。";

      await provider.generateProfile({ answers: privateAnswers });

      const passed = vi.mocked(inner.generateProfile).mock.calls[0]![0].answers;
      expect(passed.find((a) => a.questionCode === "q04")!.answer).toContain("読書とカフェ巡り");
      expect(passed.find((a) => a.questionCode === "q08")!.answer).toContain("誠実な対話を大切にしています");
      expect(passed.find((a) => a.questionCode === "q12")!.answer).toContain("チームを支える役割");
      expect(passed.find((a) => a.questionCode === "q18")!.answer).toContain("人との約束は必ず守る");
      expect(passed.find((a) => a.questionCode === "q20")!.answer).toContain("新しい場所を訪れることが好き");
    });

    it.each([
      ["q04", "名前は山田太郎です。休日は読書とカフェ巡りをして過ごします。", "山田太郎"],
      ["q08", "user@example.comへ連絡してください。誠実な対話を大切にしています。", "user@example.com"],
      ["q12", "会社は架空企画株式会社です。将来はチームを支える役割を担いたいです。", "架空企画株式会社"],
      ["q18", "090-1234-5678までご連絡を。人との約束は必ず守るようにしています。", "090-1234-5678"],
      ["q20", "山田太郎と申します。新しい場所を訪れることが好きです。", "山田太郎"],
    ] as const)("識別情報(%s: %s)はProviderへ渡す前に除去する", async (code, raw, identifier) => {
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      privateAnswers[Number(code.slice(1)) - 1]!.answer = raw;

      await provider.generateProfile({ answers: privateAnswers });

      const passed = vi.mocked(inner.generateProfile).mock.calls[0]![0].answers;
      expect(passed.find((a) => a.questionCode === code)!.answer).not.toContain(identifier);
    });

    it.each([
      "会社の同僚と飲みに行くのが好きです",
      "住所が近い人だと会いやすいと思います",
      "所属しているサークルで登山をしています",
      "部署の飲み会より少人数で話す方が好きです",
      "勤務先の近くにある公園を散歩するのが好きです",
    ])("識別語を含むだけの通常文は本文として残す(ラベル語の誤検出で内容を壊さない): %s", async (raw) => {
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      privateAnswers[3]!.answer = raw;

      await provider.generateProfile({ answers: privateAnswers });

      const passed = vi.mocked(inner.generateProfile).mock.calls[0]![0].answers;
      expect(passed.find((a) => a.questionCode === "q04")!.answer).toBe(raw);
    });

    it.each([
      ["田中太郎です", "田中太郎"],
      ["李 雷", "李雷"],
      ["山田花子", "山田花子"],
    ])("ラベルも名乗りも無い裸の氏名も除去する: %s", async (raw, identifier) => {
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      privateAnswers[3]!.answer = raw;

      await provider.generateProfile({ answers: privateAnswers });

      const passed = vi.mocked(inner.generateProfile).mock.calls[0]![0].answers;
      const sent = passed.find((a) => a.questionCode === "q04")!.answer;
      expect(normalizeForTest(sent)).not.toContain(identifier);
    });

    it("出口が識別情報とみなす語は、必ず入口でも除去されている(行き詰まり防止)", async () => {
      // 出口だけが厳しいと、AIが正当に反映した本文が漏洩と誤判定され、再試行しても回復しない。
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      const raw = "映画鑑賞です";
      privateAnswers[3]!.answer = raw;

      await provider.generateProfile({ answers: privateAnswers });

      const sent = vi.mocked(inner.generateProfile).mock.calls[0]![0].answers
        .find((a) => a.questionCode === "q04")!.answer;
      const fragments = extractSensitiveFragments(raw);
      expect(fragments.length).toBeGreaterThan(0);
      for (const fragment of fragments) {
        expect(normalizeForTest(sent)).not.toContain(fragment);
      }
    });

    it("matchでも自由記述の識別情報だけを除去して内容は残す", async () => {
      const inner = providerWith();
      const provider = new PrivacySafeAiProvider(inner);
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      privateAnswers[3]!.answer = "氏名：山田太郎です。休日は読書をして過ごします。";
      const matchInput: MatchInput = {
        answers: privateAnswers,
        profile: safeProfile,
        candidate: { conversationProfile: {} },
      };

      await provider.generateMatch(matchInput);

      const passed = vi.mocked(inner.generateMatch).mock.calls[0]![0].answers;
      const q04 = passed.find((a) => a.questionCode === "q04")!.answer;
      expect(q04).not.toContain("山田太郎");
      expect(q04).toContain("読書をして過ごします");
    });
  });

  describe("出口: assertNoPrivateAnswerLeak(識別情報が出力に漏れたら拒否する、二重防御)", () => {
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
        candidate: { conversationProfile: {} },
      })).rejects.toThrow("自由記述由来の識別情報");
    });

    it.each([
      ["休日は読書で、名前は山田太郎です。user@example.com", "山田太郎さん"],
      ["氏名：山 田・太 郎です", "山・田 太郎さん"],
      ["会社：架空企画株式会社です", "架空企画株式会社で働く人物"],
      ["所属 は 未来 対話・室です", "未来対話室のメンバー"],
      ["住所: 東京都港区芝です", "東京都港区芝の近辺"],
      ["休日は読書です。山田太郎と申します", "山田太郎さん"],
      ["Ａ Ｂ・Ｃ Ｄ といいます", "ABCDさん"],
      ["李 雷", "李雷さん"],
    ])("明示された識別候補だけを正規化して漏洩拒否する: %s", async (raw, leaked) => {
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      for (const index of [3, 7, 11, 17, 19]) privateAnswers[index]!.answer = "読書";
      privateAnswers[19]!.answer = raw;
      const provider = new PrivacySafeAiProvider(providerWith(`要約: ${leaked}`));

      await expect(provider.generateProfile({ answers: privateAnswers })).rejects.toThrow(
        "自由記述由来の識別情報",
      );
    });

    it.each([
      ["誠実な対話を大切にしています", "誠実な対話を大切にしています。"],
      ["読書", "読書も含む一般的な趣味の要約です。"],
    ])("一般文の内容が出力へ反映されただけでは拒否しない(識別情報ではないため): %s", async (raw, output) => {
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      privateAnswers[19]!.answer = raw;
      const inner = providerWith(output);
      const provider = new PrivacySafeAiProvider(inner);

      await expect(provider.generateProfile({ answers: privateAnswers })).resolves.toBeDefined();
    });

    it.each(["山田 太郎です。", "山田・太郎です。"])(
      "bare名乗りの空白・中黒を除去して氏名漏洩を拒否する: %s",
      async (raw) => {
        const privateAnswers = answers.map((answer) => ({ ...answer }));
        for (const index of [3, 7, 11, 17, 19]) privateAnswers[index]!.answer = "読書";
        privateAnswers[19]!.answer = raw;
        const provider = new PrivacySafeAiProvider(providerWith("山田太郎さんのプロフィール"));

        await expect(provider.generateProfile({ answers: privateAnswers })).rejects.toThrow(
          "自由記述由来の識別情報",
        );
      },
    );

    it.each(["対話です", "読書です"])("2字の一般語+ですは氏名扱いしない: %s", async (raw) => {
      const privateAnswers = answers.map((answer) => ({ ...answer }));
      for (const index of [3, 7, 11, 17, 19]) privateAnswers[index]!.answer = "読書";
      privateAnswers[19]!.answer = raw;
      const provider = new PrivacySafeAiProvider(providerWith(`${raw}を反映した安全な要約`));

      await expect(provider.generateProfile({ answers: privateAnswers })).resolves.toBeDefined();
    });
  });
});
