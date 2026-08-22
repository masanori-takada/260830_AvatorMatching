import { afterEach, describe, expect, it, vi } from "vitest";

import { GEMINI_MODEL, GeminiAiProvider, type GeminiClient } from "@/lib/ai/gemini-provider";
import { getAiProvider } from "@/lib/ai/provider";
import type { MatchInput, ProfileInput } from "@/lib/ai/types";

// APIキーやネットワーク通信を一切使わず、GeminiClientへ偽の実装を注入して検証する。

const profileInput: ProfileInput = {
  answers: [
    { questionCode: "q01", answer: "散歩でゆっくり過ごします", revision: 1 },
    { questionCode: "q02", answer: "気の合う友人と話すのが好きです", revision: 1 },
    { questionCode: "q04", answer: "料理に没頭すると時間を忘れます", revision: 1 },
  ],
};

const matchInput: MatchInput = {
  answers: profileInput.answers,
  profile: {
    summary: "休日は散歩や読書で過ごし、気の合う友人との対話を大切にする人物です。",
    traits: {
      leisure: "散歩や読書でゆっくり過ごす",
      communication: "気の合う友人との対話を楽しむ",
      lifestyle: "落ち着いたペースで生活する",
      values: "誠実な関わりを大切にする",
      relationships: "相手のペースを尊重する",
      priorities: "無理のない継続を重視する",
    },
  },
  candidate: {
    avatarAlias: "ルナ",
    conversationProfile: { summary: "散歩と読書が好き" },
  },
};

function buildValidProfileOutput() {
  return {
    summary: "休日は散歩や読書でゆっくり過ごし、気の合う友人との会話を大切にする人物です。",
    traits: {
      leisure: "散歩や読書でゆっくり過ごす",
      communication: "気の合う友人との対話を楽しむ",
      lifestyle: "落ち着いたペースで生活する",
      values: "誠実な関わりを大切にする",
      relationships: "相手のペースを尊重する",
      priorities: "無理のない継続を重視する",
    },
  };
}

function buildValidMatchOutput() {
  return {
    messages: Array.from({ length: 8 }, (_, index) => ({
      turnIndex: index + 1,
      speaker: index % 2 === 0 ? ("user_avatar" as const) : ("candidate_avatar" as const),
      body: `会話の発言${index + 1}です。共通の話題について話しました。`,
      answerRefs: [["q01", "q02", "q04"][index % 3]!],
    })),
    report: {
      overallScore: 78,
      summary: "会話は自然に弾み、価値観にも共通点が見られました。",
      caution: "違いは早めに言葉で確認すると安心です。",
      dimensions: [
        { axis: "conversation_flow", score: 80, explanation: "会話がテンポよく続きました。", evidenceTurnIndex: 1 },
        { axis: "values_alignment", score: 75, explanation: "価値観に共通点がありました。", evidenceTurnIndex: 2 },
        { axis: "humor_fit", score: 70, explanation: "軽い冗談が通じ合いました。", evidenceTurnIndex: 3 },
        { axis: "mutual_interest", score: 82, explanation: "互いへの関心が見られました。", evidenceTurnIndex: 4 },
        { axis: "mismatch_severity", score: 20, explanation: "大きな不一致は見られませんでした。", evidenceTurnIndex: 5 },
      ],
    },
  };
}

describe("GeminiAiProvider", () => {
  it("正常系: 契約を満たすJSONを返せば、そのまま検証済み出力になる(profile)", async () => {
    const client: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify(buildValidProfileOutput())),
    };
    const provider = new GeminiAiProvider({ client });

    const result = await provider.generateProfile(profileInput);

    expect(result).toEqual(buildValidProfileOutput());
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it("正常系: 契約を満たすJSONを返せば、そのまま検証済み出力になる(match)", async () => {
    const client: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify(buildValidMatchOutput())),
    };
    const provider = new GeminiAiProvider({ client });

    const result = await provider.generateMatch(matchInput);

    expect(result).toEqual(buildValidMatchOutput());
    expect(client.generateJson).toHaveBeenCalledTimes(1);
  });

  it("再試行: 1回目が契約違反で2回目が正常なら成功する", async () => {
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ foo: "bar" }))
      .mockResolvedValueOnce(JSON.stringify(buildValidProfileOutput()));
    const provider = new GeminiAiProvider({ client: { generateJson } });

    const result = await provider.generateProfile(profileInput);

    expect(result).toEqual(buildValidProfileOutput());
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it("失敗: 2回とも契約違反ならINVALID_OUTPUTを投げる", async () => {
    const generateJson = vi.fn().mockResolvedValue(JSON.stringify({ foo: "bar" }));
    const provider = new GeminiAiProvider({ client: { generateJson } });

    await expect(provider.generateProfile(profileInput)).rejects.toThrow("INVALID_OUTPUT");
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it("再試行: answerRefsに渡していないコードを含む出力は1回目で拒否され、2回目の正常な出力で成功する", async () => {
    const outputWithUndisclosedRef = {
      ...buildValidMatchOutput(),
      messages: buildValidMatchOutput().messages.map((message, index) => index === 0
        ? { ...message, answerRefs: ["q05"] } // matchInput.answersにq05は含まれない
        : message),
    };
    const generateJson = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(outputWithUndisclosedRef))
      .mockResolvedValueOnce(JSON.stringify(buildValidMatchOutput()));
    const provider = new GeminiAiProvider({ client: { generateJson } });

    const result = await provider.generateMatch(matchInput);

    expect(result).toEqual(buildValidMatchOutput());
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it("失敗: 2回ともanswerRefsに渡していないコードを含めればINVALID_OUTPUTを投げる", async () => {
    const outputWithUndisclosedRef = {
      ...buildValidMatchOutput(),
      messages: buildValidMatchOutput().messages.map((message, index) => index === 0
        ? { ...message, answerRefs: ["q05"] }
        : message),
    };
    const generateJson = vi.fn().mockResolvedValue(JSON.stringify(outputWithUndisclosedRef));
    const provider = new GeminiAiProvider({ client: { generateJson } });

    await expect(provider.generateMatch(matchInput)).rejects.toThrow("INVALID_OUTPUT");
    expect(generateJson).toHaveBeenCalledTimes(2);
  });

  it("タイムアウト: 応答が遅いとき制限時間で失敗する", async () => {
    const client: GeminiClient = {
      // 永遠に解決しないPromiseで、応答が遅い状態を再現する
      generateJson: () => new Promise(() => {}),
    };
    const provider = new GeminiAiProvider({ client, timeoutMs: 30 });

    await expect(provider.generateMatch(matchInput)).rejects.toThrow("TIMEOUT");
  });

  it("プロンプトに自由記述の内容が含まれ、かつ識別情報が含まれないこと", async () => {
    const client: GeminiClient = {
      generateJson: vi.fn().mockResolvedValue(JSON.stringify(buildValidProfileOutput())),
    };
    const provider = new GeminiAiProvider({ client });
    const input: ProfileInput = {
      answers: [
        { questionCode: "q01", answer: "散歩でゆっくり過ごします", revision: 1 },
        // PrivacySafeAiProvider側で識別情報は既に[非公開]化されている想定
        { questionCode: "q04", answer: "料理に没頭すると時間を忘れます。[非公開]", revision: 1 },
      ],
    };

    await provider.generateProfile(input);

    const prompt = vi.mocked(client.generateJson).mock.calls[0]![0].prompt;
    expect(prompt).toContain("料理に没頭すると時間を忘れます");
    expect(prompt).not.toMatch(/@|山田太郎|090-\d{4}-\d{4}/u);
  });
});

describe("getAiProvider(gemini)", () => {
  const originalKey = process.env.GEMINI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  it("GEMINI_API_KEY未設定ならモックへフォールバックせずエラーになる", () => {
    delete process.env.GEMINI_API_KEY;

    expect(() => getAiProvider("gemini")).toThrow("GEMINI_API_KEY");
  });

  it("GEMINI_API_KEY設定済みならGeminiAiProviderをPrivacySafeAiProviderでラップして返す", () => {
    // テスト専用のダミー値であり実際のAPIキーではない
    process.env.GEMINI_API_KEY = "dummy-test-key-not-real";

    const provider = getAiProvider("gemini");

    expect(provider.providerId).toBe(`gemini:${GEMINI_MODEL}`);
  });
});
