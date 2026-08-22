import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserSupabaseClient } = vi.hoisted(() => ({ createBrowserSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient }));

import { MatchingProgress } from "@/features/matching/client/matching-progress";

const THREE_QUEUED = [
  { matchRunId: "run-1", status: "queued" as const },
  { matchRunId: "run-2", status: "queued" as const },
  { matchRunId: "run-3", status: "queued" as const },
];

describe("MatchingProgress", () => {
  const removeChannel = vi.fn();
  const realtimeHandlers: Array<(payload: { new: { id: string; status: string } }) => void> = [];

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
      in: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
    createBrowserSupabaseClient.mockReturnValue({
      channel: vi.fn(() => channel), removeChannel, from: vi.fn(() => query),
    });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("queuedのrunだけ1リクエスト1件でPOSTする", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ status: "processing" }),
    }));
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch).toHaveBeenCalledWith("/api/match-runs/run-1/process", { method: "POST" });
    expect(fetch).toHaveBeenCalledWith("/api/match-runs/run-2/process", { method: "POST" });
    expect(fetch).toHaveBeenCalledWith("/api/match-runs/run-3/process", { method: "POST" });
  });

  it("処理中は「n件中m件完了」を表示する", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "processing" }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "processing" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("status")).toHaveTextContent("3件中1件完了");
  });

  it("全件完了ならマッチ結果への導線を人数付きで出す", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }),
    }));
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("link", { name: "マッチ結果を見る（3人）" })).toHaveAttribute("href", "/matches");
  });

  it("一部失敗しても完了が1件でもあれば結果を見られる(失敗表示にしない)", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }) })
      .mockResolvedValueOnce({ ok: false, json: vi.fn() })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("link", { name: "マッチ結果を見る（2人）" })).toBeVisible();
  });

  it("全滅した場合だけ失敗表示にし、再試行できる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: vi.fn() }));
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("heading", { name: "会話を完了できませんでした" })).toBeVisible();
    expect(screen.getByRole("button", { name: "もう一度試す" })).toBeVisible();
  });

  it("Realtime更新で該当runだけ状態を反映する", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    await act(async () => realtimeHandlers[0]?.({ new: { id: "run-1", status: "completed" } }));
    expect(screen.getByText("候補1: 会話が完了しました")).toBeVisible();
    expect(screen.getByText("候補2: 会話中です")).toBeVisible();
  });

  it("unmountで監視をcleanupする", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const view = render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    view.unmount();
    expect(removeChannel).toHaveBeenCalledOnce();
  });

  it("候補が1人だけでも(3人未満)成立する", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }),
    }));
    render(<MatchingProgress matches={[{ matchRunId: "run-1", status: "queued" }]} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("link", { name: "マッチ結果を見る（1人）" })).toBeVisible();
  });

  it("失敗した候補だけを再試行できる", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }) })
      .mockResolvedValueOnce({ ok: false, json: vi.fn() })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ status: "completed" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<MatchingProgress matches={THREE_QUEUED} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    fireEvent.click(screen.getByRole("button", { name: "失敗した候補をもう一度試す" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("link", { name: "マッチ結果を見る（3人）" })).toBeVisible();
  });
});
