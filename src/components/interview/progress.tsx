import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import styles from "./interview.module.css";

type ProgressProps = {
  answeredCount: number;
  total?: number;
};

export function Progress({ answeredCount, total = TOTAL_QUESTIONS }: ProgressProps) {
  const safeCount = Math.min(Math.max(answeredCount, 0), total);
  return (
    <>
      <div className={styles.headingRow}>
        <h1 className={styles.title}>AIインタビュー</h1>
        <span className={styles.count}>{safeCount} / {total}</span>
      </div>
      <div
        aria-label={`インタビュー進捗 ${safeCount} / ${total}`}
        aria-valuemax={total}
        aria-valuemin={0}
        aria-valuenow={safeCount}
        className={styles.track}
        role="progressbar"
      >
        <div className={styles.fill} style={{ width: `${(safeCount / total) * 100}%` }} />
      </div>
    </>
  );
}
