import styles from "./action-error.module.css";

type ActionErrorProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
};

export function ActionError({
  message,
  onRetry,
  retryLabel = "もう一度試す",
  title = "操作を完了できませんでした",
}: ActionErrorProps) {
  return (
    <section aria-live="assertive" className={styles.error} role="alert">
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      {onRetry ? (
        <button className={styles.retry} onClick={onRetry} type="button">
          {retryLabel}
        </button>
      ) : null}
    </section>
  );
}
