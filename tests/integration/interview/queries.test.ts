import { describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

import { getInterviewState } from "@/features/interview/server/queries";

describe("getInterviewState", () => {
  it("本人の回答数・revision・ロック状態を質問とまとめて返す", async () => {
    const questionResult = {
      data: [{
        code: "q01",
        display_order: 1,
        category: "休日・趣味",
        kind: "choice",
        prompt: "休日の過ごし方に最も近いのは？",
        choices: ["外へ出かける", "家でゆっくりする", "日によって半々"],
        min_length: null,
        max_length: null,
      }],
      error: null,
    };
    const answerResult = {
      data: [{ question_code: "q01", answer: "外へ出かける", revision: 2 }],
      error: null,
    };
    const from = vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => table === "interview_questions"
          ? { order: vi.fn().mockResolvedValue(questionResult) }
          : Promise.resolve(answerResult)),
      })),
    }));
    createServerSupabaseClient.mockResolvedValue({
      from,
      rpc: vi.fn().mockResolvedValue({ data: true, error: null }),
    });

    await expect(getInterviewState("a6f2ec36-33b5-4e8a-9e67-30e1f637e094")).resolves.toMatchObject({
      answeredCount: 1,
      locked: true,
      answers: [{ questionCode: "q01", answer: "外へ出かける", revision: 2 }],
      questions: [{ code: "q01", displayOrder: 1, kind: "choice" }],
    });
    expect(from).toHaveBeenCalledWith("interview_questions");
    expect(from).toHaveBeenCalledWith("interview_answers");
  });
});
