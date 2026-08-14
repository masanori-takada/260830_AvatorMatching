import styles from "./report.module.css";

export function ScoreBar({ label, score, inverted = false }: { label: string; score: number; inverted?: boolean }) {
  return (
    <div
      aria-label={`${label} ${score} / 100${inverted ? "、低いほど良い" : "、高いほど良い"}`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={score}
      className={styles.meter}
      role="meter"
    >
      <span className={inverted ? styles.neutralFill : styles.fill} style={{ width: `${score}%` }} />
    </div>
  );
}
