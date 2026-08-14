"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";

import { useMatchRun } from "./use-match-run";
import styles from "./matching-progress.module.css";

export function MatchingProgress({ matchRunId, initialStatus }: {
  matchRunId: string;
  initialStatus: "queued" | "processing" | "completed" | "failed";
}) {
  const { status, restart, applyProcessStatus } = useMatchRun({ matchRunId, initialStatus });
  const requested = useRef(false);

  const processMatch = useCallback(async (restartMonitoring = false) => {
    if (requested.current) return;
    requested.current = true;
    if (restartMonitoring) restart();
    try {
      const response = await fetch(`/api/match-runs/${matchRunId}/process`, { method: "POST" });
      if (!response.ok) {
        applyProcessStatus("failed");
        return;
      }
      const payload = await response.json() as { status?: unknown };
      if (["queued", "processing", "completed", "failed"].includes(String(payload.status))) {
        applyProcessStatus(payload.status as "queued" | "processing" | "completed" | "failed");
      } else {
        applyProcessStatus("failed");
      }
    } catch {
      applyProcessStatus("failed");
    } finally {
      requested.current = false;
    }
  }, [applyProcessStatus, matchRunId, restart]);

  useEffect(() => {
    if (initialStatus !== "queued") return;
    const timer = setTimeout(() => void processMatch(), 0);
    return () => clearTimeout(timer);
  }, [initialStatus, processMatch]);

  function retry() {
    void processMatch(true);
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
