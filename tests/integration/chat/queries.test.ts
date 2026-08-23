import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser, getCurrentConnectedConnection, getCandidateReveal } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireUser: vi.fn(),
  getCurrentConnectedConnection: vi.fn(),
  getCandidateReveal: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));
vi.mock("@/features/connection/server/queries", () => ({ getCurrentConnectedConnection }));
vi.mock("@/features/decision/server/queries", () => ({ getCandidateReveal }));

import { getCurrentChat } from "@/features/chat/server/queries";

const connection = {
  id: "11111111-1111-4111-8111-111111111111",
  matchRunId: "22222222-2222-4222-8222-222222222222",
  state: "connected" as const,
  contactDecision: "accept" as const,
};

describe("getCurrentChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("未接続ならchatデータを返さず、直接URLの認可を守る", async () => {
    getCurrentConnectedConnection.mockResolvedValue(null);
    await expect(getCurrentChat()).resolves.toBeNull();
    expect(createServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("connected ownerだけが安全な候補情報と時系列メッセージを取得する", async () => {
    getCurrentConnectedConnection.mockResolvedValue(connection);
    getCandidateReveal.mockResolvedValue({
      matchRunId: connection.matchRunId,
      firstName: "ルナ",
      ageRange: "30代前半",
      interests: ["読書"],
      bio: "架空の紹介",
      photoPath: "/images/demo-candidates/luna.webp",
      isAiGenerated: true,
    });
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.order.mockImplementationOnce(() => query).mockImplementationOnce(async () => ({
      data: [{ id: "message-1", sender: "candidate", body: "こんにちは", created_at: "2026-08-23T00:00:00Z" }],
      error: null,
    }));
    createServerSupabaseClient.mockResolvedValue({ from: vi.fn(() => query) });

    await expect(getCurrentChat()).resolves.toEqual({
      connectionId: connection.id,
      candidate: { firstName: "ルナ", photoPath: "/images/demo-candidates/luna.webp", isAiGenerated: true },
      messages: [{ id: "message-1", sender: "candidate", body: "こんにちは", createdAt: "2026-08-23T00:00:00Z" }],
    });
    expect(query.eq).toHaveBeenCalledWith("owner_id", "owner-a");
    expect(query.eq).toHaveBeenCalledWith("connection_id", connection.id);
  });
});
