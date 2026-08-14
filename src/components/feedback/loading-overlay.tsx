"use client";

import { useEffect, useRef } from "react";

import styles from "./loading-overlay.module.css";

type LoadingOverlayProps = {
  isLoading?: boolean;
  label?: string;
};

export function LoadingOverlay({
  isLoading = true,
  label = "読み込んでいます",
}: LoadingOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!isLoading || !dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }
    dialog.focus();

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, [isLoading]);

  if (!isLoading) {
    return null;
  }

  return (
    <dialog
      aria-busy="true"
      aria-label={label}
      aria-live="polite"
      aria-modal="true"
      className={styles.overlay}
      onCancel={(event) => event.preventDefault()}
      ref={dialogRef}
      tabIndex={-1}
    >
      <span aria-hidden="true" className={styles.spinner} />
      <span>{label}</span>
    </dialog>
  );
}
