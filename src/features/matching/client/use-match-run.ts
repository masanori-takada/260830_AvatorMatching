"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [generation, setGeneration] = useState<number | null>(
    initialStatus === "completed" || initialStatus === "failed" ? null : 0,
  );
  const statusRef = useRef<MatchViewStatus>(initialStatus);
  const generationRef = useRef<number | null>(
    initialStatus === "completed" || initialStatus === "failed" ? null : 0,
  );
  const nextGenerationRef = useRef(0);
  const requestRef = useRef<{ generation: number; controller: AbortController } | null>(null);

  const abortRequest = useCallback((expectedGeneration?: number) => {
    const request = requestRef.current;
    if (!request || (expectedGeneration !== undefined && request.generation !== expectedGeneration)) return;
    requestRef.current = null;
    request.controller.abort();
  }, []);

  const transition = useCallback((next: MatchViewStatus, expectedGeneration: number) => {
    if (generationRef.current !== expectedGeneration) return false;
    if (["completed", "failed", "timed_out"].includes(statusRef.current)) return false;
    statusRef.current = next;
    setStatus(next);
    if (next === "completed" || next === "failed" || next === "timed_out") {
      generationRef.current = null;
      setGeneration(null);
      abortRequest(expectedGeneration);
    }
    return true;
  }, [abortRequest]);

  const restart = useCallback(() => {
    abortRequest();
    const nextGeneration = ++nextGenerationRef.current;
    generationRef.current = nextGeneration;
    statusRef.current = "processing";
    setStatus("processing");
    setErrorCode(null);
    setGeneration(nextGeneration);
    return nextGeneration;
  }, [abortRequest]);

  const applyProcessStatus = useCallback((
    next: "queued" | "processing" | "completed" | "failed",
    expectedGeneration: number,
  ) => transition(next, expectedGeneration), [transition]);

  const registerRequest = useCallback((expectedGeneration: number, controller: AbortController) => {
    if (generationRef.current !== expectedGeneration) {
      controller.abort();
      return false;
    }
    abortRequest();
    requestRef.current = { generation: expectedGeneration, controller };
    return true;
  }, [abortRequest]);

  const releaseRequest = useCallback((expectedGeneration: number, controller: AbortController) => {
    if (requestRef.current?.generation === expectedGeneration && requestRef.current.controller === controller) {
      requestRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (generation === null) return;
    const activeGeneration = generation;
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
      if (!transition(next, activeGeneration)) return;
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
        transition("timed_out", activeGeneration);
        stop();
      }
    }, timeoutMs);

    return stop;
  }, [generation, matchRunId, timeoutMs, transition]);

  useEffect(() => () => abortRequest(), [abortRequest]);

  return {
    status,
    errorCode,
    retryable: status === "failed" || status === "timed_out",
    generation,
    restart,
    applyProcessStatus,
    registerRequest,
    releaseRequest,
  };
}
