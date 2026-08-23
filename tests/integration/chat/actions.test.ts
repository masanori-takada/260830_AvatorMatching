import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerSupabaseClient, requireUser } = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient }));
vi.mock("@/features/identity/server/session", () => ({ requireUser }));

import { sendChatMessage } from "@/features/chat/server/actions";

const connectionId = "11111111-1111-4111-8111-111111111111";

describe("sendChatMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ userId: "owner-a" });
  });

  it("trim済みのownerメッセージを接続RPCへ渡す", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "22222222-2222-4222-8222-222222222222", error: null });
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(sendChatMessage({ connectionId, text: "  こんにちは  " })).resolves.toEqual({
      ok: true,
      data: { messageId: "22222222-2222-4222-8222-222222222222" },
    });
    expect(rpc).toHaveBeenCalledWith("send_chat_message", {
      p_connection_id: connectionId,
      p_text: "こんにちは",
    });
  });

  it.each(["", "   ", "x".repeat(1001)])("1〜1000文字trim制約をActionでも検証する(%s)", async (text) => {
    const rpc = vi.fn();
    createServerSupabaseClient.mockResolvedValue({ rpc });

    await expect(sendChatMessage({ connectionId, text })).resolves.toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR" },
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("接続されていないownerの送信エラーをSTATE_CONFLICTへ写像する", async () => {
    createServerSupabaseClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "CHAT_NOT_CONNECTED" } }),
    });

    await expect(sendChatMessage({ connectionId, text: "こんにちは" })).resolves.toMatchObject({
      ok: false,
      error: { code: "STATE_CONFLICT", retryable: false },
    });
  });
});
