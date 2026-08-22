"use client";

import Link from "next/link";
import { useActionState } from "react";

import { PendingButton } from "@/components/feedback/pending-button";
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
        </>
      ) : (
        <>
          <p className={styles.copy}>{TOTAL_QUESTIONS}問の回答から、あなたのアバター要約を作成します。</p>
          {result && !result.ok ? <p className={styles.error} role="alert">{result.error.message}</p> : null}
        </>
      )}
      <form action={formAction}>
        {/* 要約作成後の主操作は「アバターにまかせる」。この更新ボタンは補助操作のため
            強調を下げる(不具合2対応。matching-progress.module.cssの.secondaryと同じ見た目)。 */}
        <PendingButton
          className={result?.ok ? styles.secondaryButton : styles.startButton}
          pending={pending}
          type="submit"
        >
          {pending ? "作成しています…" : result?.ok ? "要約を更新する" : "アバター要約を作成する"}
        </PendingButton>
      </form>
      {result?.ok ? (
        // 要約作成後は、アバターに会話を任せる導線を出す(不具合1対応)。
        // ホームへ戻る導線はAppShellの下部ナビ(showNavigation)が担う。
        <Link
          className={styles.startButton}
          href="/matching"
          style={{ alignItems: "center", display: "flex", justifyContent: "center", textDecoration: "none" }}
        >
          アバターにまかせる
        </Link>
      ) : null}
    </section>
  );
}
