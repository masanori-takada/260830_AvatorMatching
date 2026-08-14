import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserSupabaseClient } = vi.hoisted(() => ({ createBrowserSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient }));

import { MatchingProgress } from "@/features/matching/client/matching-progress";

describe("MatchingProgress", () => {
  const removeChannel = vi.fn();
  const realtimeHandlers: Array<(payload: { new: { status: string; error_code: string | null } }) => void> = [];

  beforeEach(() => {
    vi.useFakeTimers();
    createBrowserSupabaseClient.mockClear();
    realtimeHandlers.length = 0;
    removeChannel.mockReset();
    const channel = {
      on: vi.fn((_event, _filter, handler) => {
        realtimeHandlers.push(handler);
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      single: vi.fn(async () => ({ data: { status: "processing", error_code: null }, error: null })),
    };
    createBrowserSupabaseClient.mockReturnValue({
      channel: vi.fn(() => channel), removeChannel, from: vi.fn(() => query),
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("failed再試行で即processing表示に戻り監視を再開する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ status: "processing" }),
    }));
    render(<MatchingProgress initialStatus="failed" matchRunId="run-1" />);
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(screen.getByRole("heading", { name: "アバターが会話中です" })).toBeVisible();
    expect(createBrowserSupabaseClient).toHaveBeenCalledOnce();
  });

  it("POST成功JSONがcompletedならRealtimeを待たず完了導線を出す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }),
    }));
    render(<MatchingProgress initialStatus="queued" matchRunId="run-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("link", { name: "相性レポートを見る" })).toBeVisible();
  });

  it("POST失敗ならfailed表示にする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: vi.fn() }));
    render(<MatchingProgress initialStatus="queued" matchRunId="run-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "会話を完了できませんでした" })).toBeVisible();
  });

  it("pending POSTがtimeoutした後も再試行で新しいPOSTと監視を開始する", async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url, init: RequestInit) => {
        expect(init.signal).toBeInstanceOf(AbortSignal);
        return first.promise;
      })
      .mockImplementationOnce(() => second.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<MatchingProgress initialStatus="queued" matchRunId="run-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const firstSignal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(firstSignal.aborted).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(createBrowserSupabaseClient).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "アバターが会話中です" })).toBeVisible();
  });

  it("Realtime completed後に古いPOSTが500でも完了表示を巻き戻さない", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    render(<MatchingProgress initialStatus="queued" matchRunId="run-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => realtimeHandlers[0]?.({ new: { status: "completed", error_code: null } }));
    await act(async () => {
      pending.resolve({ ok: false } as Response);
      await pending.promise;
      await Promise.resolve();
    });

    expect(screen.getByRole("link", { name: "相性レポートを見る" })).toBeVisible();
  });

  it("Realtime completed後に古いPOSTのprocessingを受けても完了表示を巻き戻さない", async () => {
    const pending = deferred<Response>();
    vi.stubGlobal("fetch", vi.fn(() => pending.promise));
    render(<MatchingProgress initialStatus="queued" matchRunId="run-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => realtimeHandlers[0]?.({ new: { status: "completed", error_code: null } }));
    await act(async () => {
      pending.resolve({
        ok: true,
        json: async () => ({ status: "processing" }),
      } as Response);
      await pending.promise;
      await Promise.resolve();
    });

    expect(screen.getByRole("link", { name: "相性レポートを見る" })).toBeVisible();
  });

  it("unmountでpending POSTをabortし監視もcleanupする", async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn((_url, init: RequestInit) => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<MatchingProgress initialStatus="queued" matchRunId="run-1" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const signal = fetchMock.mock.calls[0]?.[1]?.signal as AbortSignal;

    view.unmount();

    expect(signal.aborted).toBe(true);
    expect(removeChannel).toHaveBeenCalledOnce();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}
