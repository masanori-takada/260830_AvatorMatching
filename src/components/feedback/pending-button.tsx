import { forwardRef } from "react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Spinner } from "./spinner";
import styles from "./pending-button.module.css";

type PendingButtonProps = {
  children: ReactNode;
  pending: boolean;
} & Omit<ComponentPropsWithoutRef<"button">, "children">;

/**
 * 送信中(pending)の見た目を足す共通ボタン。
 *
 * 押した瞬間にサーバー応答を待たず見た目を変えるため、呼び出し側は
 * useFormStatus/useActionState等の「送信開始と同時に同期的に立つpending」を
 * そのまま渡すこと(お知らせカードで先に対応済みの手法を踏襲)。
 *
 * - 通常表示(pending=false)時は、classNameで渡された既存のスタイル・マークアップの
 *   ままで、寸法や文言に変化はない(視覚回帰テストの基準画像を壊さない)。
 * - pending中は右端に固定サイズ(16px)のスピナーを絶対配置で重ねるだけなので、
 *   ボタンの幅・高さは変わらない。スピナーはaria-hiddenにし、文言(アクセシブルネーム)は
 *   変えない(aria-busyだけで送信中であることを伝える。テキストノードを足すと
 *   アクセシブルネームが「元の文言+説明文」に変わってしまい、ラベルでボタンを
 *   探す既存のテスト・支援技術操作を壊すため)。
 * - 二重送信防止のため、pending中は自動的にdisabledになる(呼び出し側のdisabledとOR)。
 */
export const PendingButton = forwardRef<HTMLButtonElement, PendingButtonProps>(function PendingButton(
  { children, className, disabled, pending, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      aria-busy={pending || undefined}
      className={`${styles.wrap} ${className ?? ""}`}
      disabled={pending || disabled}
      ref={ref}
    >
      {children}
      {pending ? (
        <span aria-hidden="true" className={styles.overlay}>
          <Spinner size={16} />
        </span>
      ) : null}
    </button>
  );
});
