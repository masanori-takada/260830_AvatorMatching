"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { resetDemoData } from "@/features/identity/server/reset-action";

import styles from "./reset-control.module.css";

/**
 * 設定画面のリセット操作。
 * 「デモをリセット」→ 確認ダイアログ(取消不能であることを明示)→「リセットする」の
 * 2段階で確定する(FR-035の受け入れシナリオ)。確認ダイアログを開いたら確定ボタンへ
 * フォーカスを移し、キーボードだけで操作できるようにする(FR-038)。
 */
export function ResetControl() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    if (!dialog.open) dialog.showModal();
    confirmRef.current?.focus();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [open]);

  function close() {
    if (submitting) return;
    setOpen(false);
    setError(null);
  }

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await resetDemoData();
    if (result.ok) {
      router.push(result.data.nextPath);
      return;
    }
    // 途中で失敗しても削除は原子的(DB側で1トランザクションに閉じている)なので、
    // 削除済み/未削除が混在した画面にはならない。技術用語を避け、再試行を促すだけでよい。
    setError(result.error.message);
    setSubmitting(false);
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.dangerButton} onClick={() => setOpen(true)} type="button">
        デモをリセット
      </button>
      <p className={styles.note}>
        保存された進行状況をすべて削除し、招待コード入力画面から再開します。展示会で次のデモを始める前に実行してください。
      </p>

      {open ? (
        <dialog
          aria-labelledby="reset-confirm-title"
          className={styles.dialog}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          ref={dialogRef}
        >
          <h2 id="reset-confirm-title">デモをリセット</h2>
          <p>
            保存されたデモの進行状況をすべて削除して、最初からやり直します。この操作は取り消せません。よろしいですか?
          </p>
          {error ? <p role="alert">{error}</p> : null}
          <div className={styles.actions}>
            <button disabled={submitting} onClick={() => void confirm()} ref={confirmRef} type="button">
              {submitting ? "リセット中…" : "リセットする"}
            </button>
            <button disabled={submitting} onClick={close} type="button">
              キャンセル
            </button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
