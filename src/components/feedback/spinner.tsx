import styles from "./spinner.module.css";

type SpinnerProps = {
  className?: string;
  size?: number;
};

/**
 * 送信中を示す回転インジケータ(共通部品)。
 * 各所の送信ボタン(お知らせカード・選択式回答・自由記述の送信・
 * インタビュー開始・アバター要約作成 等)で同じ実装を重複させないための切り出し。
 *
 * `prefers-reduced-motion`はグローバルCSS(src/app/globals.css)で
 * アニメーションを無効化する設定が入っているため、ここでの個別対応は不要。
 */
export function Spinner({ className, size = 14 }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      className={`${styles.spinner} ${className ?? ""}`}
      style={{ height: size, width: size }}
    />
  );
}
