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

const validValues = [
  "外へ出かける", "一人", "早めに決めたい", "読書です", "自分から話す",
  "たくさん話し合う", "率直に話し合う", "会話です", "外出や交流", "短くても毎日",
  "週に何度か", "誠実さです", "経験に使う", "まず試す", "早めに話したい",
  "言葉で伝える", "笑いのツボが合う", "対話します", "誠実さ", "大切なことです",
];
const answers = Array.from({ length: 20 }, (_, index) => ({
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

  it("正確な20回答を生成・検証しrevision合計付きでowner upsertする", async () => {
    const { client, rpc } = clientWith();
    createServerSupabaseClient.mockResolvedValue(client);

    await expect(completeInterview()).resolves.toEqual({
      ok: true,
      data: { summary: "3回答以上を反映した安全な要約です。", sourceRevision: 40 },
    });
    expect(rpc).toHaveBeenCalledWith("upsert_my_avatar_profile", {
      p_summary: "3回答以上を反映した安全な要約です。",
      p_traits: expect.any(Object),
      p_source_revision: 40,
      p_provider: "test-provider-v1",
    });
  });

  it.each([
    [0, "仕様外の選択肢"],
    [3, "\t\n\u00a0\u3000"],
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
      source_revision: 40,
      provider: "test-provider-v1",
    };
    const { client, rpc } = clientWith(answers, existing);
    createServerSupabaseClient.mockResolvedValue(client);

    await expect(completeInterview()).resolves.toMatchObject({ ok: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("回答が19件ならproviderを呼ばずVALIDATION_ERRORを返す", async () => {
    createServerSupabaseClient.mockResolvedValue(clientWith(answers.slice(0, 19)).client);

    await expect(completeInterview()).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
    expect(generateProfile).not.toHaveBeenCalled();
  });
});
