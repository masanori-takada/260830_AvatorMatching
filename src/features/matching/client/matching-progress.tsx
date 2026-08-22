"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { MatchRunSummary } from "@/features/matching/server/actions";

import styles from "./matching-progress.module.css";

type RunViewStatus = "queued" | "processing" | "completed" | "failed" | "timed_out";
type RunState = { matchRunId: string; status: RunViewStatus };

const SETTLED_STATUSES: readonly RunViewStatus[] = ["completed", "failed", "timed_out"];
// 1件あたり最悪40秒(Gemini呼び出し20秒タイムアウト×スキーマ違反時の再生成1回)かかりうる。
// 3件を並行して呼ぶがネットワークの揺らぎも考慮し、余裕を持たせたタイムアウトにする。
const TIMEOUT_MS = 70_000;

/**
 * 「自分のアバターが複数の相手と勝手に会話してきてくれた」という体験の見せ場。
 * 1リクエスト1件(サーバーレスの実行時間上限対策)を守りつつ、複数のrunを並行して処理し、
 * 「n件中m件完了」の進み具合を表示する。一部が失敗しても、完了した分だけは見られるようにし、
 * 全滅した場合だけ失敗表示にする。
 */
export function MatchingProgress({ matches }: { matches: MatchRunSummary[] }) {
  // queuedのrunはマウント直後に必ず処理を開始するため、初期状態から
  // 「processing」として表示する(effect内でのsetState連鎖を避けるため、
  // 初期stateの時点で織り込む)。
  const [runs, setRuns] = useState<RunState[]>(() => matches.map((match) => ({
    ...match,
    status: match.status === "queued" ? "processing" : match.status,
  })));
  const startedRef = useRef(false);

  const updateRun = useCallback((matchRunId: string, status: RunViewStatus) => {
    setRuns((prev) => prev.map((run) => {
      if (run.matchRunId !== matchRunId) return run;
      if (SETTLED_STATUSES.includes(run.status)) return run;
      return { ...run, status };
    }));
  }, []);

  const processOne = useCallback(async (matchRunId: string) => {
    try {
      const response = await fetch(`/api/match-runs/${matchRunId}/process`, { method: "POST" });
      const payload = await response.json().catch(() => null) as { status?: unknown } | null;
      const status = typeof payload?.status === "string" ? payload.status : "failed";
      updateRun(matchRunId, ["queued", "processing", "completed", "failed"].includes(status)
        ? status as RunViewStatus
        : "failed");
    } catch {
      updateRun(matchRunId, "failed");
    }
  }, [updateRun]);

  const retryFailed = useCallback(() => {
    const retryIds = runs
      .filter((run) => run.status === "failed" || run.status === "timed_out")
      .map((run) => run.matchRunId);
    if (retryIds.length === 0) return;
    // updateRunは既に確定した状態(completed/failed/timed_out)への上書きガードを持つため、
    // 「失敗から再挑戦する」ためのprocessing差し戻しはここで直接行う。
    setRuns((prev) => prev.map((run) => retryIds.includes(run.matchRunId) ? { ...run, status: "processing" } : run));
    for (const matchRunId of retryIds) void processOne(matchRunId);
  }, [runs, processOne]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // setStateを含むprocessOneをeffect本体から同期的に呼ばないよう、
    // マクロタスクへ逃がす(既存のuse-match-run.tsと同じ手法)。
    const timer = setTimeout(() => {
      for (const match of matches) {
        if (match.status === "queued") void processOne(match.matchRunId);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [matches, processOne]);

  useEffect(() => {
    const ids = matches.map((match) => match.matchRunId);
    if (ids.length === 0) return;
    const client = createBrowserSupabaseClient();
    const channel = client
      .channel(`match-runs:${ids.join(",")}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "match_runs" },
        (payload) => {
          const row = payload.new as { id?: string; status?: string };
          if (row.id && ids.includes(row.id) && typeof row.status === "string"
            && ["queued", "processing", "completed", "failed"].includes(row.status)) {
            updateRun(row.id, row.status as RunViewStatus);
          }
        },
      )
      .subscribe();

    const pollTimer = setInterval(() => {
      void (async () => {
        const { data } = await client.from("match_runs").select("id, status").in("id", ids);
        for (const row of data ?? []) {
          if (typeof row.status === "string") updateRun(row.id as string, row.status as RunViewStatus);
        }
      })();
    }, 3_000);

    const timeoutTimer = setTimeout(() => {
      setRuns((prev) => prev.map((run) => (run.status === "queued" || run.status === "processing")
        ? { ...run, status: "timed_out" }
        : run));
    }, TIMEOUT_MS);

    return () => {
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      void client.removeChannel(channel);
    };
  }, [matches, updateRun]);

  const total = runs.length;
  const completedCount = runs.filter((run) => run.status === "completed").length;
  const failedCount = runs.filter((run) => run.status === "failed" || run.status === "timed_out").length;
  const settledCount = completedCount + failedCount;
  const allSettled = total > 0 && settledCount >= total;
  const allFailed = allSettled && completedCount === 0;

  if (allFailed) {
    return (
      <div className={styles.stack}>
        <section aria-live="polite" className={styles.card}>
          <span aria-hidden="true" className={styles.errorIcon}>A</span>
          <div>
            <h1 className={styles.title}>会話を完了できませんでした</h1>
            <p className={styles.copy}>回答は保存されています。通信を確認して、もう一度お試しください。</p>
          </div>
        </section>
        <button className={styles.primary} onClick={retryFailed} type="button">もう一度試す</button>
      </div>
    );
  }

  if (allSettled) {
    return (
      <div className={styles.stack}>
        <Link className={styles.primary} href="/matches">
          マッチ結果を見る（{completedCount}人）
        </Link>
        {failedCount > 0 ? (
          <button className={styles.secondary} onClick={retryFailed} type="button">失敗した候補をもう一度試す</button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <section aria-live="polite" className={styles.card}>
        <span aria-hidden="true" className={styles.pulse}>A</span>
        <div>
          <h1 className={styles.title}>アバターが会話中です</h1>
          <p className={styles.copy}>
            あなたのアバターが、{total}人の匿名の候補アバターと同時に会話を進めています。
          </p>
        </div>
      </section>
      <p className={styles.progressLabel} role="status">
        {total}件中{settledCount}件完了{failedCount > 0 ? `（うち失敗 ${failedCount}件）` : ""}
      </p>
      <ol className={styles.runList}>
        {runs.map((run, index) => (
          <li className={styles.runItem} data-status={run.status} key={run.matchRunId}>
            <span aria-hidden="true" className={styles.runMark}>{runMark(run.status, index)}</span>
            <span>{runLabel(run.status, index)}</span>
          </li>
        ))}
      </ol>
      {failedCount > 0 ? (
        <button className={styles.secondary} onClick={retryFailed} type="button">失敗した候補をもう一度試す</button>
      ) : null}
      <p className={styles.note}>相性レポートが完成すると、お知らせに届きます。</p>
    </div>
  );
}

function runMark(status: RunViewStatus, index: number): string {
  if (status === "completed") return "✓";
  if (status === "failed" || status === "timed_out") return "!";
  return String(index + 1);
}

function runLabel(status: RunViewStatus, index: number): string {
  switch (status) {
    case "completed":
      return `候補${index + 1}: 会話が完了しました`;
    case "failed":
      return `候補${index + 1}: 会話に失敗しました`;
    case "timed_out":
      return `候補${index + 1}: 応答に時間がかかっています`;
    case "processing":
      return `候補${index + 1}: 会話中です`;
    default:
      return `候補${index + 1}: これから会話します`;
  }
}
