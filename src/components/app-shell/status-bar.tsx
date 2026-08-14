import styles from "./app-shell.module.css";

export function StatusBar() {
  return (
    <div aria-label="端末の状態" className={styles.statusBar}>
      <span>9:41</span>
      <span aria-hidden="true" className={styles.statusIcons}>
        <svg viewBox="0 0 24 24">
          <path d="M3 17h2v-2H3v2Zm4 0h2v-5H7v5Zm4 0h2V9h-2v8Zm4 0h2V6h-2v11Zm4 0h2V3h-2v14Z" />
        </svg>
        <svg viewBox="0 0 24 24">
          <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10.5 10.5 0 0 1 14 0m-11 3.5a6 6 0 0 1 8 0M12 19h.01" />
        </svg>
        <svg viewBox="0 0 28 14">
          <rect height="12" rx="3" width="24" x="1" y="1" />
          <path d="M26 5v4" />
          <rect fill="currentColor" height="8" rx="1.5" width="15" x="3" y="3" />
        </svg>
      </span>
    </div>
  );
}
