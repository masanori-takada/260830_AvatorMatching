import styles from "./loading-overlay.module.css";

type LoadingOverlayProps = {
  isLoading?: boolean;
  label?: string;
};

export function LoadingOverlay({
  isLoading = true,
  label = "読み込んでいます",
}: LoadingOverlayProps) {
  if (!isLoading) {
    return null;
  }

  return (
    <div aria-live="polite" className={styles.overlay} role="status">
      <span aria-hidden="true" className={styles.spinner} />
      <span>{label}</span>
    </div>
  );
}
