import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserSupabaseClient } = vi.hoisted(() => ({ createBrowserSupabaseClient: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient }));

import { MatchingProgress } from "@/features/matching/client/matching-progress";

describe("MatchingProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
    const query = { select: vi.fn(() => query), eq: vi.fn(() => query), single: vi.fn() };
    createBrowserSupabaseClient.mockReturnValue({
      channel: vi.fn(() => channel), removeChannel: vi.fn(), from: vi.fn(() => query),
    });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

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
});
