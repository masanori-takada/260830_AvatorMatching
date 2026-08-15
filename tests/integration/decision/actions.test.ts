import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(), requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { commitDecision } from "@/features/decision/server/actions";
import { getCandidateReveal, getCurrentCandidateReveal, hasCurrentDecline } from "@/features/decision/server/queries";

const matchRunId = "11111111-1111-4111-8111-111111111111";

/** decisions参照のPostgRESTチェーンを、末端のmaybeSingleが解決する形で組み立てる。 */
function decisionsQueryStub(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const chain: Record<string, unknown> = { order, limit, maybeSingle };
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.select = vi.fn().mockReturnValue(chain);
  return { from: vi.fn().mockReturnValue(chain), order, limit };
}

describe("decision server境界", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("入力を検証してowner決定RPCの結果を遷移先へ写像する", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { kind: "accept" }, error: null });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(commitDecision({ matchRunId, kind: "accept" })).resolves.toEqual({
      ok: true,
      data: { kind: "accept", nextPath: "/reveal" },
    });
    expect(rpc).toHaveBeenCalledWith("commit_decision", { p_match_run_id: matchRunId, p_kind: "accept" });
  });

  it("opposite retryをSTATE_CONFLICTへ写像する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "DECISION_CONFLICT:decline" } }),
    });

    await expect(commitDecision({ matchRunId, kind: "accept" })).resolves.toEqual({
      ok: false,
      error: {
        code: "STATE_CONFLICT",
        message: "すでに辞退が確定しています。",
        retryable: false,
        details: { storedDecision: "decline", nextPath: "/declined" },
      },
    });
  });

  it("認証失敗をUNAUTHENTICATEDとして秘匿する", async () => {
    const { UnauthenticatedError } = await import("@/lib/errors");
    requireUser.mockRejectedValue(new UnauthenticatedError());
    await expect(commitDecision({ matchRunId, kind: "accept" })).resolves.toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "認証が必要です", retryable: false },
    });
  });

  it("不正入力ではRPCを呼ばない", async () => {
    const rpc = vi.fn();
    createServerSupabaseClient.mockResolvedValue({ rpc });
    await expect(commitDecision({ matchRunId: "bad", kind: "accept" })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("開示RPCの固定4列だけを返す", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{
      full_name: "星野みなと", company: "架空株式会社ルーメン", department: "架空企画室", bio: "完全に架空の紹介です。",
    }], error: null });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(getCandidateReveal(matchRunId)).resolves.toEqual({
      fullName: "星野みなと", company: "架空株式会社ルーメン", department: "架空企画室", bio: "完全に架空の紹介です。",
    });
    expect(rpc).toHaveBeenCalledWith("get_candidate_reveal", { p_match_run_id: matchRunId });
  });

  it("未承諾では開示を返さない", async () => {
    createServerSupabaseClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: [], error: null }) });
    await expect(getCandidateReveal(matchRunId)).resolves.toBeNull();
  });

  it("承諾決定が複数あっても最新1件へ絞って開示する", async () => {
    const decisions = decisionsQueryStub({ data: { match_run_id: matchRunId }, error: null });
    const rpc = vi.fn().mockResolvedValue({ data: [{
      full_name: "星乃 ルナ（完全架空）", company: "ルミナス架空企画株式会社（完全架空）",
      department: "未来対話デザイン室（完全架空）", bio: "完全に架空の紹介です。",
    }], error: null });
    createServerSupabaseClient.mockResolvedValue({ from: decisions.from, rpc });

    await expect(getCurrentCandidateReveal()).resolves.toMatchObject({ fullName: "星乃 ルナ（完全架空）" });
    expect(decisions.order).toHaveBeenCalledWith("decided_at", { ascending: false });
    expect(decisions.limit).toHaveBeenCalledWith(1);
  });

  it("決定照会のDBエラーを握りつぶさない", async () => {
    const decisions = decisionsQueryStub({ data: null, error: { message: "connection lost" } });
    createServerSupabaseClient.mockResolvedValue({ from: decisions.from, rpc: vi.fn() });

    await expect(getCurrentCandidateReveal()).rejects.toMatchObject({ message: "connection lost" });
  });

  it("辞退決定が複数あっても最新1件へ絞って判定する", async () => {
    const decisions = decisionsQueryStub({ data: { id: "decision-1" }, error: null });
    createServerSupabaseClient.mockResolvedValue({ from: decisions.from, rpc: vi.fn() });

    await expect(hasCurrentDecline()).resolves.toBe(true);
    expect(decisions.order).toHaveBeenCalledWith("decided_at", { ascending: false });
    expect(decisions.limit).toHaveBeenCalledWith(1);
  });
});
