"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { commitDecision } from "@/features/decision/server/actions";
import { waitForMinimumPending } from "@/lib/pending";

import { PendingButton } from "./pending-button";
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
    const startedAt = Date.now();
    try {
      const result = await commitDecision({ matchRunId, kind });
      await waitForMinimumPending(startedAt);
      if (result.ok) {
        router.push(result.data.nextPath);
        return;
      }
      if (result.error.code === "STATE_CONFLICT" && result.error.details) {
        router.push(result.error.details.nextPath);
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
    <section aria-labelledby="decision-title" className={styles.card}>
      <h2 id="decision-title">この出会いをどうしますか？</h2>
      <p>決定は一度だけです。プロフィール開示までは個人情報は開示されません。</p>
      <div className={styles.actions}>
        <button className={styles.primary} onClick={() => setKind("accept")} type="button">プロフィール開示を希望</button>
        <button className={styles.secondary} onClick={() => setKind("decline")} type="button">今回は見送る</button>
      </div>
      {kind ? (
        <dialog
          aria-labelledby="decision-confirm-title"
          className={styles.dialog}
          onCancel={(event) => { event.preventDefault(); close(); }}
          ref={dialogRef}
        >
          <h2 id="decision-confirm-title">{kind === "accept" ? "プロフィール開示を確認" : "見送りを確認"}</h2>
          <p>{kind === "accept"
            ? "下の名前、年齢層、趣味、自己紹介文、写真（AI生成の架空画像）だけが開示されます。姓・会社・部署・メールアドレス・電話番号は表示されません。確定しますか？"
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
              {kind === "accept" ? "プロフィール開示を確定" : "今回は見送る"}
            </PendingButton>
            <button disabled={submitting} onClick={close} type="button">キャンセル</button>
          </div>
        </dialog>
      ) : null}
    </section>
  );
}
