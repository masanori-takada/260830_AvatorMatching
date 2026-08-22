import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, generateProfile, getAiProvider, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  generateProfile: vi.fn(),
  getAiProvider: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));
vi.mock("@/lib/ai/provider", () => ({ getAiProvider }));

import { completeInterview } from "@/features/avatar-profile/server/service";

// q01〜q20は既存の性格・価値観の質問、q21〜q37は基本プロフィール(全てchoice)、
// q38〜q41は開示意思(全てchoice)。question_code昇順(サーバー側のorder("question_code")と同じ)で並べる。
const validValues = [
  "外へ出かける", "一人", "早めに決めたい", "読書です", "自分から話す",
  "たくさん話し合う", "率直に話し合う", "会話です", "外出や交流", "短くても毎日",
  "週に何度か", "誠実さです", "経験に使う", "まず試す", "早めに話したい",
  "言葉で伝える", "笑いのツボが合う", "対話します", "誠実さ", "大切なことです",
  "男性", "20代前半", "関東", "〜155cm", "スリム",
  "大学卒", "会社員", "〜400万円", "土日", "一人暮らし",
  "未婚", "なし", "欲しい", "すぐにでも", "まず会って話したい",
  "吸わない", "飲まない",
  "アバター同士の会話で触れてよい", "会ってから自分で話したい",
  "アバター同士の会話で触れてよい", "会ってから自分で話したい",
];
const answers = Array.from({ length: 41 }, (_, index) => ({
  question_code: `q${String(index + 1).padStart(2, "0")}`,
  answer: validValues[index]!,
  revision: 2,
}));

function clientWith(answerRows = answers, existingProfile: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
  const from = vi.fn((table: string) => table === "interview_answers"
    ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: answerRows, error: null }) })) })) }
    : { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: existingProfile, error: null }) })) })) });
  return { client: { from, rpc }, rpc };
}

describe("completeInterview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" });
    getAiProvider.mockReturnValue({ providerId: "test-provider-v1", generateProfile });
    generateProfile.mockResolvedValue({
      summary: "3回答以上を反映した安全な要約です。",
      traits: {
        leisure: "読書", communication: "傾聴", lifestyle: "安定",
        values: "誠実", relationships: "対話", priorities: "調和",
      },
    });
  });

  it("正確な41回答を生成・検証しrevision合計付きでowner upsertする", async () => {
    const { client, rpc } = clientWith();
    createServerSupabaseClient.mockResolvedValue(client);

    await expect(completeInterview()).resolves.toEqual({
      ok: true,
      data: { summary: "3回答以上を反映した安全な要約です。", sourceRevision: 82 },
    });
    expect(rpc).toHaveBeenCalledWith("upsert_my_avatar_profile", {
      p_summary: "3回答以上を反映した安全な要約です。",
      p_traits: expect.any(Object),
      p_source_revision: 82,
      p_provider: "test-provider-v1",
    });
  });

  it("デリケートな回答と開示意思の回答自体は、アバター要約生成へ渡す入力から除外する", async () => {
    const { client } = clientWith();
    createServerSupabaseClient.mockResolvedValue(client);

    await completeInterview();

    // 要約は特定の相手を前提としないため、相手のいない時点ではデリケートな回答
    // (年収q28・職業q27・最終学歴q26・身長q24・体型q25・婚姻歴q31・子どもの有無q32)と
    // 開示意思の回答そのもの(q38〜q41)を一切AIへ渡さない。
    const passedCodes = vi.mocked(generateProfile).mock.calls[0]![0].answers
      .map((a: { questionCode: string }) => a.questionCode);
    for (const sensitiveCode of ["q24", "q25", "q26", "q27", "q28", "q31", "q32", "q38", "q39", "q40", "q41"]) {
      expect(passedCodes).not.toContain(sensitiveCode);
    }
    expect(passedCodes).toContain("q01");
    expect(passedCodes).toContain("q21");
  });

  it.each([
    [0, "仕様外の選択肢"],
    [3, "\t\n\u00a0\u3000"],
    [15, "山田太郎です"],
  ])("不正回答が1件でもあればproviderと保存を呼ばない: q%s", async (index, invalidValue) => {
    const invalidAnswers = answers.map((answer) => ({ ...answer }));
    invalidAnswers[index]!.answer = invalidValue;
    const { client, rpc } = clientWith(invalidAnswers);
    createServerSupabaseClient.mockResolvedValue(client);

    await expect(completeInterview()).resolves.toMatchObject({
      ok: false, error: { code: "VALIDATION_ERROR" },
    });
    expect(generateProfile).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("同一profileが既存ならwriteをスキップしてupdated_atを維持する", async () => {
    const existing = {
      summary: "3回答以上を反映した安全な要約です。",
      traits: {
        leisure: "読書", communication: "傾聴", lifestyle: "安定",
        values: "誠実", relationships: "対話", priorities: "調和",
      },
      source_revision: 82,
      provider: "test-provider-v1",
    };
    const { client, rpc } = clientWith(answers, existing);
    createServerSupabaseClient.mockResolvedValue(client);

    await expect(completeInterview()).resolves.toMatchObject({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("回答が40件ならproviderを呼ばずVALIDATION_ERRORを返す", async () => {
    createServerSupabaseClient.mockResolvedValue(clientWith(answers.slice(0, 40)).client);

    await expect(completeInterview()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
    expect(generateProfile).not.toHaveBeenCalled();
  });
});
