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

const answers = Array.from({ length: 20 }, (_, index) => ({
  question_code: `q${String(index + 1).padStart(2, "0")}`,
  answer: `回答${index + 1}`,
  revision: 2,
}));

function clientWith(answerRows = answers) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn((table: string) => table === "interview_answers"
    ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: answerRows, error: null }) })) })) }
    : { upsert });
  return { client: { from }, upsert };
}

describe("completeInterview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" });
    getAiProvider.mockReturnValue({ generateProfile });
    generateProfile.mockResolvedValue({
      summary: "3回答以上を反映した安全な要約です。",
      traits: {
        leisure: "読書", communication: "傾聴", lifestyle: "安定",
        values: "誠実", relationships: "対話", priorities: "調和",
      },
    });
  });

  it("正確な20回答を生成・検証しrevision合計付きでowner upsertする", async () => {
    const { client, upsert } = clientWith();
    createServerSupabaseClient.mockResolvedValue(client);

    await expect(completeInterview()).resolves.toEqual({
      ok: true,
      data: { summary: "3回答以上を反映した安全な要約です。", sourceRevision: 40 },
    });
    expect(upsert).toHaveBeenCalledWith({
      owner_id: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094",
      summary: "3回答以上を反映した安全な要約です。",
      traits: expect.any(Object),
      source_revision: 40,
      provider: "mock-v1",
    }, { onConflict: "owner_id" });
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
