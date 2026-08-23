"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { commitContactDecision } from "@/features/connection/server/actions";
import { waitForMinimumPending } from "@/lib/pending";

import { PendingButton } from "../feedback/pending-button";
import styles from "../feedback/decision-dialog.module.css";

type DecisionKind = "accept" | "decline";

export function ContactDecision({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [kind, setKind] = useState<DecisionKind | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!kind || !dialog) return;
    if (!dialog.open) dialog.showModal();
    confirmRef.current?.focus();
    return () => { if (dialog.open) dialog.close(); };
  }, [kind]);

  function close() {
    if (submitting) return;
    setKind(null);
    setError(null);
  }

  async function confirm() {
    if (!kind || submitting) return;
    setSubmitting(true);
    setError(null);
    const startedAt = Date.now();
    try {
      const result = await commitContactDecision({ connectionId, kind });
      await waitForMinimumPending(startedAt);
      if (result.ok) {
        router.push(result.data.state === "connected" ? "/chat" : "/matches");
        return;
      }
      setError(result.error.message);
    } catch {
      await waitForMinimumPending(startedAt);
      setError("処理に失敗しました。時間をおいて再試行してください。");
    }
    setSubmitting(false);
  }

  return (
    <section aria-labelledby="contact-decision-title" className={styles.card}>
      <h2 id="contact-decision-title">この方と話してみますか？</h2>
      <p>最終承認が双方で完了すると、1対1のテキストチャットが開きます。</p>
      {!kind ? (
        <div className={styles.actions}>
          <button className={styles.primary} onClick={() => setKind("accept")} type="button">連絡を希望する</button>
          <button className={styles.secondary} onClick={() => setKind("decline")} type="button">今回は見送る</button>
        </div>
      ) : (
        <dialog
          aria-labelledby="contact-confirm-title"
          className={styles.dialog}
          onCancel={(event) => { event.preventDefault(); close(); }}
          ref={dialogRef}
        >
          <h2 id="contact-confirm-title">{kind === "accept" ? "連絡希望を確認" : "見送りを確認"}</h2>
          <p>{kind === "accept"
            ? "承認が完了すると、候補者からの固定挨拶と、あなたのメッセージだけで会話できます。確定しますか？"
            : "今回はこの候補を見送ります。別の候補を選べるようになります。確定しますか？"}</p>
          {error ? <p role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <PendingButton
              disabled={submitting}
              onClick={() => void confirm()}
              pending={submitting}
              ref={confirmRef}
              type="button"
            >
              {kind === "accept" ? "連絡を希望する" : "今回は見送る"}
            </PendingButton>
            <button disabled={submitting} onClick={close} type="button">キャンセル</button>
          </div>
        </dialog>
      )}
    </section>
  );
}

