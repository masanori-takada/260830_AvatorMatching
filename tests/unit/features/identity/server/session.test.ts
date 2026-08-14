import { describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));

import { UnauthenticatedError } from "@/lib/errors";
import { requireUser } from "@/features/identity/server/session";

describe("requireUser", () => {
  it("検証済みclaimのsubjectを現在の利用者IDとして返す", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: { sub: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094" } },
          error: null,
        }),
      },
    });

    await expect(requireUser()).resolves.toEqual({
      userId: "a6f2ec36-33b5-4e8a-9e67-30e1f637e094",
    });
  });

  it("claimがない場合は未認証として拒否する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      auth: {
        getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
      },
    });

    await expect(requireUser()).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
