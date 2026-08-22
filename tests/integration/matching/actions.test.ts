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

  it("owner検証後に原子的start RPCの冪等結果を複数件返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { match_run_id: "11111111-1111-4111-8111-111111111111", status: "queued" },
        { match_run_id: "22222222-2222-4222-8222-222222222222", status: "queued" },
        { match_run_id: "33333333-3333-4333-8333-333333333333", status: "queued" },
      ], error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(startMatch()).resolves.toEqual({
      ok: true,
      data: { matches: [
        { matchRunId: "11111111-1111-4111-8111-111111111111", status: "queued" },
        { matchRunId: "22222222-2222-4222-8222-222222222222", status: "queued" },
        { matchRunId: "33333333-3333-4333-8333-333333333333", status: "queued" },
      ] },
    });
    expect(requireUser).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("start_match_run");
  });

  it("候補者が3人未満でも、いる分だけ返す", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ match_run_id: "11111111-1111-4111-8111-111111111111", status: "queued" }], error: null,
    });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(startMatch()).resolves.toEqual({
      ok: true,
      data: { matches: [{ matchRunId: "11111111-1111-4111-8111-111111111111", status: "queued" }] },
    });
  });
  it("既存completed runも冪等な再開結果として返す", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: [{ match_run_id: "11111111-1111-4111-8111-111111111111", status: "completed" }], error: null,
      }),
    });
    await expect(startMatch()).resolves.toMatchObject({
      ok: true,
      data: { matches: [{ status: "completed" }] },
    });
  });
});
