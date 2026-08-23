import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { commitContactDecision } from "@/features/connection/server/actions";

const connectionId = "11111111-1111-4111-8111-111111111111";

describe("commitContactDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("接続ownerの最終承認RPCを結果へ写像する", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ state: "connected", connection_id: connectionId }],
      error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(commitContactDecision({ connectionId, kind: "accept" })).resolves.toEqual({
      ok: true,
      data: { state: "connected", connectionId },
    });
    expect(rpc).toHaveBeenCalledWith("commit_contact_decision", {
      p_connection_id: connectionId,
      p_kind: "accept",
    });
  });

  it("最終見送りはconnectionIdを返さずclosedへ写像する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: [{ state: "closed", connection_id: null }], error: null }),
    });

    await expect(commitContactDecision({ connectionId, kind: "decline" })).resolves.toEqual({
      ok: true,
      data: { state: "closed", connectionId: null },
    });
  });

  it("プロフィール開示前の最終承認をSTATE_CONFLICTへ写像する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "CONTACT_STATE_CONFLICT" } }),
    });

    await expect(commitContactDecision({ connectionId, kind: "accept" })).resolves.toMatchObject({
      ok: false,
      error: { code: "STATE_CONFLICT", retryable: false },
    });
  });

  it("DBが最終判断NULLを拒否した場合は友好的な入力エラーへ写像する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "INVALID_CONTACT_DECISION" } }),
    });

    await expect(commitContactDecision({ connectionId, kind: "accept" })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", retryable: false },
    });
  });

  it("不正なconnectionIdではRPCを呼ばない", async () => {
    const rpc = vi.fn();
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(commitContactDecision({ connectionId: "bad", kind: "accept" })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
