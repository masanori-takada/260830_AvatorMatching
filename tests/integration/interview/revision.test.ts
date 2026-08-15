import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { saveInterviewAnswer } from "@/features/interview/server/actions";

describe("回答修正とrevision競合(中断・再開シナリオ)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" });
  });

  it("マッチング開始前は既存回答をrevision指定で修正できる", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ revision: 2, answered_count: 8, next_question_order: 9 }],
      error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(saveInterviewAnswer({
      questionCode: "q08",
      answer: "修正後の回答",
      expectedRevision: 1,
    })).resolves.toEqual({
      ok: true,
      data: { revision: 2, answeredCount: 8, nextPath: "/interview/9" },
    });
  });

  it("マッチング開始後の修正はINTERVIEW_LOCKEDとして拒否し理由を説明する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "INTERVIEW_LOCKED" },
      }),
    });

    await expect(saveInterviewAnswer({
      questionCode: "q01",
      answer: "家でゆっくりする",
      expectedRevision: 1,
    })).resolves.toEqual({
      ok: false,
      error: {
        code: "STATE_CONFLICT",
        message: "マッチング開始後は回答を変更できません。",
        retryable: false,
      },
    });
  });

  it("別タブで先に確定した修正がある場合、古いrevisionでの再送はSTATE_CONFLICTになる", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "P0001", message: "STATE_CONFLICT" },
      }),
    });

    const result = await saveInterviewAnswer({
      questionCode: "q08",
      answer: "古いタブからの回答",
      expectedRevision: 1,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "STATE_CONFLICT", retryable: false },
    });
  });

  it("中断後に端末を再読込して再開した場合、expectedRevision nullでも既存回答として保存できる", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ revision: 1, answered_count: 8, next_question_order: 9 }],
      error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(saveInterviewAnswer({
      questionCode: "q08",
      answer: "再開後の回答",
      expectedRevision: null,
    })).resolves.toMatchObject({ ok: true, data: { answeredCount: 8 } });
    expect(rpc).toHaveBeenCalledWith("save_interview_answer", {
      p_question_code: "q08",
      p_answer: "再開後の回答",
      p_expected_revision: null,
    });
  });
});
