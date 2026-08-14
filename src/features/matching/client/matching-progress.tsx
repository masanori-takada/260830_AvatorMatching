"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useMatchRun } from "./use-match-run";
import styles from "./matching-progress.module.css";

export function MatchingProgress({ matchRunId, initialStatus }: {
  matchRunId: string;
  initialStatus: "queued" | "processing" | "completed" | "failed";
}) {
  const { status } = useMatchRun({ matchRunId, initialStatus });
  const requested = useRef(false);
  const [requestError, setRequestError] = useState(false);

  const processMatch = useCallback(async () => {
    if (requested.current) return;
    requested.current = true;
    try {
      const response = await fetch(`/api/match-runs/${matchRunId}/process`, { method: "POST" });
      if (!response.ok) setRequestError(true);
    } catch {
      setRequestError(true);
    }
  }, [matchRunId]);

  useEffect(() => {
    if (initialStatus !== "queued") return;
    const timer = setTimeout(() => void processMatch(), 0);
    return () => clearTimeout(timer);
  }, [initialStatus, processMatch]);

  function retry() {
    requested.current = false;
    setRequestError(false);
    void processMatch();
  }

  if (status === "completed") {
    return <Link className={styles.primary} href={`/report?matchRunId=${matchRunId}`}>相性レポートを見る</Link>;
  }
  const failed = status === "failed" || status === "timed_out" || requestError;
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
