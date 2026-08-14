import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, generateMatch, getAiProvider, getOwnedMatchInput, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  generateMatch: vi.fn(),
  getAiProvider: vi.fn(),
  getOwnedMatchInput: vi.fn(),
  requireUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));
vi.mock("@/lib/ai/provider", () => ({ getAiProvider }));
vi.mock("@/features/matching/server/queries", () => ({ getOwnedMatchInput }));

import { processOwnedMatch } from "@/features/matching/server/process";

const output = {
  messages: Array.from({ length: 8 }, (_, index) => ({
    turnIndex: index + 1,
    speaker: index % 2 === 0 ? "user_avatar" as const : "candidate_avatar" as const,
    body: `安全な発言${index + 1}`,
    answerRefs: index < 3 ? [`q0${index + 1}`] : [],
  })),
  report: {
    overallScore: 75,
    summary: "安全な要約",
    caution: "違いは対話で確認します。",
    dimensions: ["conversation_flow", "values_alignment", "humor_fit", "mutual_interest", "mismatch_severity"].map((axis, index) => ({
      axis, score: 70, explanation: "安全な根拠", evidenceTurnIndex: index + 1,
    })),
  },
};

describe("processOwnedMatch", () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
    createServerSupabaseClient.mockResolvedValue({ rpc });
    rpc.mockResolvedValueOnce({ data: "processing", error: null }).mockResolvedValueOnce({ data: null, error: null });
    getOwnedMatchInput.mockResolvedValue({
      answers: [], profile: { summary: "安全", traits: {} },
      candidate: { avatarAlias: "ルナ", conversationProfile: {} },
    });
    getAiProvider.mockReturnValue({ providerId: "mock-v1", generateMatch });
    generateMatch.mockResolvedValue(output);
  });

  it("owner runをclaimしprivacy provider出力をcomplete RPCへ渡す", async () => {
    await expect(processOwnedMatch("11111111-1111-4111-8111-111111111111")).resolves.toBe("completed");
    expect(requireUser).toHaveBeenCalledOnce();
    expect(getOwnedMatchInput).toHaveBeenCalledWith(expect.anything(), "11111111-1111-4111-8111-111111111111", "owner-a");
    expect(generateMatch).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenNthCalledWith(2, "complete_match_run", {
      p_match_run_id: "11111111-1111-4111-8111-111111111111", p_payload: output,
    });
  });

  it("completed runの再処理ではproviderを呼ばない", async () => {
    rpc.mockReset().mockResolvedValue({ data: "completed", error: null });
    await expect(processOwnedMatch("11111111-1111-4111-8111-111111111111")).resolves.toBe("completed");
    expect(generateMatch).not.toHaveBeenCalled();
  });

  it("provider失敗は本文を保存・ログせず許可済みcodeだけでfailする", async () => {
    generateMatch.mockRejectedValue(new Error("secret raw answer"));
    await expect(processOwnedMatch("11111111-1111-4111-8111-111111111111")).rejects.toThrow();
    expect(rpc).toHaveBeenLastCalledWith("fail_match_run", {
      p_match_run_id: "11111111-1111-4111-8111-111111111111", p_error_code: "PROVIDER_ERROR",
    });
  });
});
