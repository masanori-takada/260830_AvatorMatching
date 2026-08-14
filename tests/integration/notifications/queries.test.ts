import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(), requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { getOwnedNotifications, markNotificationRead } from "@/features/notifications/server/queries";

describe("notification queries", () => {
  beforeEach(() => { vi.clearAllMocks(); requireUser.mockResolvedValue({ userId: "owner-a" }); });

  it("owner filterで通知を新しい順に取得する", async () => {
    const order = vi.fn(async () => ({ data: [], error: null }));
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), order };
    createServerSupabaseClient.mockResolvedValue({ from: vi.fn(() => query) });
    await expect(getOwnedNotifications()).resolves.toEqual([]);
    expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-a");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("既読更新はowner検証RPCだけを呼ぶ", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "2026-08-15T00:00:00Z", error: null });
    createServerSupabaseClient.mockResolvedValue({ rpc });
    await expect(markNotificationRead("notification-1")).resolves.toBe("2026-08-15T00:00:00Z");
    expect(rpc).toHaveBeenCalledWith("mark_notification_read", { p_notification_id: "notification-1" });
  });
});
