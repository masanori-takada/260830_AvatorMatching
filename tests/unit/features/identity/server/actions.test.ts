import { describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

import { startAnonymousJourney } from "@/features/identity/server/actions";

describe("startAnonymousJourney", () => {
  it("既存の匿名セッションを再利用して開始操作を冪等にする", async () => {
    const signInAnonymously = vi.fn();
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" } },
          error: null,
        }),
        signInAnonymously,
      },
    });

    await expect(startAnonymousJourney()).resolves.toEqual({
      ok: true,
      data: { nextPath: "/interview/1" },
    });
    expect(signInAnonymously).not.toHaveBeenCalled();
  });

  it("セッションがない場合だけ匿名サインインを開始する", async () => {
    const signInAnonymously = vi.fn().mockResolvedValue({
      data: { user: { id: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" } },
      error: null,
    });
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
        signInAnonymously,
      },
    });

    await expect(startAnonymousJourney()).resolves.toEqual({
      ok: true,
      data: { nextPath: "/interview/1" },
    });
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("匿名サインイン失敗時に内部詳細を返さない", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
        signInAnonymously: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("secret provider detail"),
        }),
      },
    });

    await expect(startAnonymousJourney()).resolves.toEqual({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "処理に失敗しました。時間をおいて再試行してください。",
        retryable: true,
      },
    });
  });
});
