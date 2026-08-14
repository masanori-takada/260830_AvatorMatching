import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(), requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { startMatch } from "@/features/matching/server/actions";

describe("startMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("owner検証後に原子的start RPCの冪等結果を返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ match_run_id: "11111111-1111-4111-8111-111111111111", status: "queued" }], error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(startMatch()).resolves.toEqual({
      ok: true,
      data: { matchRunId: "11111111-1111-4111-8111-111111111111", status: "queued" },
    });
    expect(requireUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("start_match_run");
  });
  it("回答revisionとプロフィールがずれた場合は再生成を案内する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "STALE_PROFILE" } }),
    });

    await expect(startMatch()).resolves.toMatchObject({
      ok: false,
      error: { code: "STATE_CONFLICT", retryable: false },
    });
  });
});
