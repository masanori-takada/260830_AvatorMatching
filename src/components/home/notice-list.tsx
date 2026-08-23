import Link from "next/link";

import type { NotificationItem } from "@/features/notifications/server/queries";
import { notificationHref } from "@/features/notifications/route";
import styles from "./home.module.css";

type NoticeListProps = {
  notifications: NotificationItem[];
};

// ホーム上の「お知らせ」カード。既存デモの直近2件表示 + 「すべて見る」導線を再現する。
export function NoticeList({ notifications }: NoticeListProps) {
  const recent = notifications.slice(0, 2);

  return (
    <section aria-label="お知らせ" className={styles.card}>
      <div className={styles.cardHead}>
        <h2 className={styles.sectionTitleFlush}>お知らせ</h2>
        <Link className={styles.linkButton} href="/notifications">すべて見る &gt;</Link>
      </div>
      {recent.length === 0 ? (
        <p className={styles.bodyText}>まだお知らせはありません。</p>
      ) : (
        <ul className={styles.noticeRows}>
          {recent.map((item) => (
            <li key={item.id}>
              <Link
                className={styles.noticeRow}
                href={notificationHref(item) ?? "/notifications"}
              >
                <span className={styles.noticeRowBody}>
                  <span className={styles.cardTitle}>{item.title}</span>
                  <time className={styles.time}>{new Date(item.createdAt).toLocaleString("ja-JP")}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
