"use client";

import { useFormStatus } from "react-dom";

import type { NotificationItem } from "@/features/notifications/server/queries";

import { Spinner } from "@/components/feedback/spinner";
import styles from "@/app/(journey)/journey.module.css";
import cardStyles from "./notification-card.module.css";

type Props = {
  action: () => Promise<void>;
  item: NotificationItem;
};

/**
 * お知らせ1件分のカード(クライアントコンポーネント)。
 *
 * 既読化→再検証→リダイレクトはリモートのSupabaseへの往復を伴うため、
 * 押してから画面が切り替わるまでにラグが生じる。押した瞬間に見た目が変わらないと
 * 「反応がない」と誤解されて連打され、二重送信につながる(過去にアバター要約ボタンでも
 * 同種の問題が発生している。tests/e2e/support/avatar-summary.ts 参照)。
 *
 * Server Action自体(既読化・再検証・リダイレクト)のロジックはページ側([journey]/notifications/page.tsx)
 * に残したまま、ここでは送信中の見た目(ボタン無効化・進捗表示)だけを担当する。
 */
export function NotificationCard({ action, item }: Props) {
  return (
    <form action={action}>
      <NotificationButton item={item} />
    </form>
  );
}

function NotificationButton({ item }: { item: NotificationItem }) {
  // useFormStatusは親<form>のsubmit状態を参照するため、<form>とは別のコンポーネントで呼ぶ必要がある
  const { pending } = useFormStatus();
  const unread = !item.readAt;

  return (
    <button
      aria-busy={pending}
      className={`${styles.notice} ${unread ? styles.unread : ""}`}
      disabled={pending}
      type="submit"
    >
      {unread ? <span aria-label="未読" className={styles.dot} /> : null}
      <span className={styles.noticeBody}>
        <span className={styles.noticeTitle}>{item.title}</span>
        <span className={styles.noticeCopy}>{item.body}</span>
        <time className={styles.time}>{new Date(item.createdAt).toLocaleString("ja-JP")}</time>
      </span>
      {pending ? (
        <span className={cardStyles.indicator}>
          <Spinner />
          <span className={cardStyles.srOnly}>開いています…</span>
        </span>
      ) : (
        <span aria-hidden="true" className={cardStyles.indicator}>›</span>
      )}
    </button>
  );
}
