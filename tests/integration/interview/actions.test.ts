import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { saveInterviewAnswer } from "@/features/interview/server/actions";

describe("saveInterviewAnswer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" });
  });

  it("回答をrevision付きで保存し、回答数と次の画面を返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ revision: 1, answered_count: 1, next_question_order: 2 }],
      error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(
      saveInterviewAnswer({
        questionCode: "q01",
        answer: "外へ出かける",
        expectedRevision: null,
      }),
    ).resolves.toEqual({
      ok: true,
      data: { revision: 1, answeredCount: 1, nextPath: "/interview/2" },
    });
    expect(rpc).toHaveBeenCalledWith("save_interview_answer", {
      p_question_code: "q01",
      p_answer: "外へ出かける",
      p_expected_revision: null,
    });
  });

  it("回答数ではなくDBが返す最初の未回答質問へ遷移する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ revision: 2, answered_count: 10, next_question_order: 3 }],
        error: null,
      }),
    });

    await expect(saveInterviewAnswer({
      questionCode: "q01",
      answer: "家でゆっくりする",
      expectedRevision: 1,
    })).resolves.toMatchObject({ ok: true, data: { nextPath: "/interview/3" } });
  });

  it("古いrevisionによる更新をSTATE_CONFLICTとして返す", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "STATE_CONFLICT" },
      }),
    });

    await expect(
      saveInterviewAnswer({
        questionCode: "q01",
        answer: "家でゆっくりする",
        expectedRevision: 1,
      }),
    ).resolves.toEqual({
      ok: false,
      error: {
        code: "STATE_CONFLICT",
        message: "回答が別の画面で更新されました。再読み込みしてお試しください。",
        retryable: false,
      },
    });
  });

  it("別タブで回答順が進んだ場合もSTATE_CONFLICTとして返す", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "OUT_OF_ORDER" },
      }),
    });

    await expect(saveInterviewAnswer({
      questionCode: "q02",
      answer: "一人",
      expectedRevision: null,
    })).resolves.toMatchObject({
      ok: false,
      error: { code: "STATE_CONFLICT", retryable: false },
    });
  });

  it("自由記述の空白だけの回答はDBへ送らない", async () => {
    const rpc = vi.fn();
    createServerSupabaseClient.mockResolvedValue({ rpc });

    const result = await saveInterviewAnswer({
      questionCode: "q20",
      answer: "   ",
      expectedRevision: null,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(rpc).not.toHaveBeenCalled();
  });
});
