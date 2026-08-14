"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { useMatchRun } from "./use-match-run";
import styles from "./matching-progress.module.css";

export function MatchingProgress({ matchRunId, initialStatus }: {
  matchRunId: string;
  initialStatus: "queued" | "processing" | "completed" | "failed";
}) {
  const {
    status,
    restart,
    applyProcessStatus,
    registerRequest,
    releaseRequest,
  } = useMatchRun({ matchRunId, initialStatus });
  const requestRef = useRef<AbortController | null>(null);

  const processMatch = useCallback(async (generation: number, replace = false) => {
    if (requestRef.current && !replace) return;
    const controller = new AbortController();
    if (!registerRequest(generation, controller)) return;
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/match-runs/${matchRunId}/process`, {
        method: "POST",
        signal: controller.signal,
      });
      if (!response.ok) {
        applyProcessStatus("failed", generation);
        return;
      }
      const payload = await response.json() as { status?: unknown };
      if (["queued", "processing", "completed", "failed"].includes(String(payload.status))) {
        applyProcessStatus(payload.status as "queued" | "processing" | "completed" | "failed", generation);
      } else {
        applyProcessStatus("failed", generation);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        applyProcessStatus("failed", generation);
      }
    } finally {
      releaseRequest(generation, controller);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [applyProcessStatus, matchRunId, registerRequest, releaseRequest]);

  useEffect(() => {
    if (initialStatus !== "queued") return;
    const timer = setTimeout(() => void processMatch(0), 0);
    return () => clearTimeout(timer);
  }, [initialStatus, processMatch]);

  function retry() {
    const generation = restart();
    void processMatch(generation, true);
  }

  if (status === "completed") {
    return <Link className={styles.primary} href={`/report?matchRunId=${matchRunId}`}>相性レポートを見る</Link>;
  }
  const failed = status === "failed" || status === "timed_out";
  return (
    <div className={styles.stack}>
      <section aria-live="polite" className={styles.card}>
        <span aria-hidden="true" className={failed ? styles.errorIcon : styles.pulse}>A</span>
        <div>
          <h1 className={styles.title}>{failed ? "会話を完了できませんでした" : "アバターが会話中です"}</h1>
          <p className={styles.copy}>{failed
            ? "回答は保存されています。通信を確認して、もう一度お試しください。"
            : "あなたのアバターが、匿名の候補アバターと会話を進めています。"}</p>
        </div>
      </section>
      {failed ? <button className={styles.primary} onClick={retry} type="button">もう一度試す</button> : null}
      <p className={styles.note}>相性レポートが完成すると、お知らせに届きます。</p>
    </div>
  );
}
