import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { processOwnedMatch } = vi.hoisted(() => ({ processOwnedMatch: vi.fn() }));
vi.mock("@/features/matching/server/process", () => ({ processOwnedMatch }));

import { POST } from "@/app/api/match-runs/[id]/process/route";

describe("match processing route", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [new Error("STATE_CONFLICT"), 409],
    [(() => { try { z.object({ ok: z.string() }).parse({}); } catch (error) { return error as Error; } })(), 422],
    [new Error("provider unavailable"), 500],
  ])("内部情報を返さず処理エラーをHTTPへ写像する", async (error, expectedStatus) => {
    processOwnedMatch.mockRejectedValue(error);
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    });

    expect(response.status).toBe(expectedStatus);
    expect(await response.json()).toEqual({ status: "failed" });
  });
});
