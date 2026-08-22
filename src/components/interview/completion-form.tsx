"use client";

import { useActionState } from "react";

import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import type { ActionResult } from "@/lib/result";
import styles from "./interview.module.css";

type Completion = { summary: string; sourceRevision: number };

export function CompletionForm({
  action,
}: {
  action: () => Promise<ActionResult<Completion>>;
}) {
  const [result, formAction, pending] = useActionState(
    async () => action(),
    null as ActionResult<Completion> | null,
  );

  return (
    <section className={styles.complete}>
      <h2 className={styles.title}>回答が完了しました</h2>
      {result?.ok ? (
        <>
          <p className={styles.copy}>{result.data.summary}</p>
          <p className={styles.hint}>回答revision合計: {result.data.sourceRevision}</p>
        </>
      ) : (
        <>
          <p className={styles.copy}>{TOTAL_QUESTIONS}問の回答から、あなたのアバター要約を作成します。</p>
          {result && !result.ok ? <p className={styles.error} role="alert">{result.error.message}</p> : null}
        </>
      )}
      <form action={formAction}>
        <button className={styles.startButton} disabled={pending} type="submit">
          {pending ? "作成しています…" : result?.ok ? "要約を更新する" : "アバター要約を作成する"}
        </button>
      </form>
    </section>
  );
}
