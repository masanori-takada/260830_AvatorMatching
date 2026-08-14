"use client";

import { useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export type MatchViewStatus = "queued" | "processing" | "completed" | "failed" | "timed_out";

type UseMatchRunInput = {
  matchRunId: string;
  initialStatus: Exclude<MatchViewStatus, "timed_out">;
  timeoutMs?: number;
};

export function useMatchRun({ matchRunId, initialStatus, timeoutMs = 30_000 }: UseMatchRunInput) {
  const [status, setStatus] = useState<MatchViewStatus>(initialStatus);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (initialStatus === "completed" || initialStatus === "failed") return;
    const client = createBrowserSupabaseClient();
    let stopped = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    const channel = client.channel(`match-run:${matchRunId}`).on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "match_runs", filter: `id=eq.${matchRunId}` },
      (payload) => applyRow(payload.new as { status?: string; error_code?: string | null }),
    ).subscribe();

    function stop() {
      if (stopped) return;
      stopped = true;
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      void client.removeChannel(channel);
    }

    function applyRow(row: { status?: string; error_code?: string | null }) {
      if (stopped || !["queued", "processing", "completed", "failed"].includes(row.status ?? "")) return;
      const next = row.status as Exclude<MatchViewStatus, "timed_out">;
      setStatus(next);
      setErrorCode(row.error_code ?? null);
      if (next === "completed" || next === "failed") stop();
    }

    pollTimer = setInterval(async () => {
      const { data, error } = await client.from("match_runs")
        .select("status, error_code").eq("id", matchRunId).single();
      if (!error && data) applyRow(data);
    }, 2_000);
    timeoutTimer = setTimeout(() => {
      if (!stopped) {
        setStatus("timed_out");
        stop();
      }
    }, timeoutMs);

    return stop;
  }, [initialStatus, matchRunId, timeoutMs]);

  return { status, errorCode, retryable: status === "failed" || status === "timed_out" };
}
