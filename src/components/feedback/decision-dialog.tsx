"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { commitDecision } from "@/features/decision/server/actions";

import styles from "./decision-dialog.module.css";

type DecisionKind = "accept" | "decline";

export function DecisionDialog({ matchRunId }: { matchRunId: string }) {
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
    const result = await commitDecision({ matchRunId, kind });
    if (result.ok) {
      router.push(result.data.nextPath);
      return;
    }
    if (result.error.code === "STATE_CONFLICT" && result.error.details) {
      router.push(result.error.details.nextPath);
      return;
    }
    setError(result.error.message);
    setSubmitting(false);
  }

  return (
    <section aria-labelledby="decision-title" className={styles.card}>
      <h2 id="decision-title">この出会いをどうしますか？</h2>
      <p>決定は一度だけです。承諾するまで氏名や所属は開示されません。</p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={() => setKind("accept")} type="button">承諾する</button>
        <button className={styles.secondary} onClick={() => setKind("decline")} type="button">辞退する</button>
      </div>
      {kind ? (
        <dialog
          aria-labelledby="decision-confirm-title"
          className={styles.dialog}
          onCancel={(event) => { event.preventDefault(); close(); }}
          ref={dialogRef}
        >
          <h2 id="decision-confirm-title">{kind === "accept" ? "承諾を確認" : "辞退を確認"}</h2>
          <p>{kind === "accept"
            ? "承諾すると、完全な架空候補の氏名と所属が開示されます。確定しますか？"
            : "辞退すると、この候補の情報は開示されません。確定しますか？"}</p>
          {error ? <p role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button disabled={submitting} onClick={() => void confirm()} ref={confirmRef} type="button">
              {kind === "accept" ? "承諾を確定する" : "辞退を確定する"}
            </button>
            <button disabled={submitting} onClick={close} type="button">キャンセル</button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
