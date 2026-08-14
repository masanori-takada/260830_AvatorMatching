import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserSupabaseClient } = vi.hoisted(() => ({ createBrowserSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient }));

import { useMatchRun } from "@/features/matching/client/use-match-run";

describe("useMatchRun", () => {
  const removeChannel = vi.fn();
  let realtimeHandler: (payload: { new: { status: string; error_code: string | null } }) => void;
  let pollResult = { data: { status: "processing", error_code: null }, error: null };

  beforeEach(() => {
    vi.useFakeTimers();
    createBrowserSupabaseClient.mockClear();
    removeChannel.mockReset();
    const channel = {
      on: vi.fn((_event, _filter, handler) => { realtimeHandler = handler; return channel; }),
      subscribe: vi.fn(() => channel),
    };
    const single = vi.fn(async () => pollResult);
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), single };
    createBrowserSupabaseClient.mockReturnValue({
      channel: vi.fn(() => channel), removeChannel, from: vi.fn(() => query),
    });
  });

  afterEach(() => vi.useRealTimers());

  it("Realtimeで終端状態を受けたら購読とpollを解除する", async () => {
    const { result } = renderHook(() => useMatchRun({
      matchRunId: "run-1", initialStatus: "processing", timeoutMs: 30_000,
    }));
    await act(async () => realtimeHandler({ new: { status: "completed", error_code: null } }));
    expect(result.current.status).toBe("completed");
    expect(removeChannel).toHaveBeenCalledOnce();
  });

  it("2秒pollをfallbackにし30秒でtimed_outにする", async () => {
    pollResult = { data: { status: "processing", error_code: null }, error: null };
    const { result } = renderHook(() => useMatchRun({
      matchRunId: "run-1", initialStatus: "queued", timeoutMs: 30_000,
    }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(result.current.status).toBe("processing");
    await act(async () => { await vi.advanceTimersByTimeAsync(28_000); });
    expect(result.current.status).toBe("timed_out");
    expect(removeChannel).toHaveBeenCalledOnce();
  });

  it("failedからrestartするとprocessingで再購読しtimeoutを張り直す", async () => {
    const { result } = renderHook(() => useMatchRun({
      matchRunId: "run-1", initialStatus: "failed", timeoutMs: 30_000,
    }));
    expect(createBrowserSupabaseClient).not.toHaveBeenCalled();
    act(() => result.current.restart());
    expect(result.current.status).toBe("processing");
    expect(createBrowserSupabaseClient).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(29_999); });
    expect(result.current.status).toBe("processing");
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.status).toBe("timed_out");
  });

  it("連続restartで前世代をcleanupしchannelとintervalを重複させない", () => {
    const { result } = renderHook(() => useMatchRun({
      matchRunId: "run-1", initialStatus: "failed", timeoutMs: 30_000,
    }));
    act(() => result.current.restart());
    act(() => result.current.restart());
    expect(createBrowserSupabaseClient).toHaveBeenCalledTimes(2);
    expect(removeChannel).toHaveBeenCalledTimes(1);
  });
});
