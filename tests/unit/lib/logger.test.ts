import { afterEach, describe, expect, it, vi } from "vitest";
import { logError } from "@/lib/logger";

describe("logError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("回答本文と秘密情報を伏せて構造化ログへ出力する", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("anonymous_session_failed", {
      answer: "この回答本文はログに出してはいけない",
      accessToken: "secret-token",
      requestId: "request-123",
    });

    const entry = JSON.parse(error.mock.calls[0]?.[0] as string) as Record<string, unknown>;
    expect(entry).toEqual({
      level: "error",
      event: "anonymous_session_failed",
      requestId: "request-123",
    });
  });
});
