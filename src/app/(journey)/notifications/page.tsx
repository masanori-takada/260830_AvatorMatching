import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getOwnedNotifications, markNotificationRead } from "@/features/notifications/server/queries";
import styles from "../journey.module.css";

export default async function NotificationsPage() {
  const notifications = await getOwnedNotifications();
  return (
    <AppShell activeTab="notifications" showNavigation>
      <h1 className={styles.title}>お知らせ</h1>
      {notifications.length === 0 ? <p className={styles.empty}>まだお知らせはありません。アバターが会話を続けています。</p> : (
        <div className={styles.stack}>
          {notifications.map((item) => (
            <form action={async () => {
              "use server";
              await markNotificationRead(item.id);
              revalidatePath("/notifications");
              if (item.matchRunId) redirect(`/report?matchRunId=${item.matchRunId}`);
            }} key={item.id}>
              <button className={`${styles.notice} ${item.readAt ? "" : styles.unread}`} type="submit">
                {!item.readAt ? <span aria-label="未読" className={styles.dot} /> : null}
                <span className={styles.noticeBody}><span className={styles.noticeTitle}>{item.title}</span><span className={styles.noticeCopy}>{item.body}</span><time className={styles.time}>{new Date(item.createdAt).toLocaleString("ja-JP")}</time></span>
                <span aria-hidden="true">›</span>
              </button>
            </form>
          ))}
        </div>
      )}
    </AppShell>
  );
}
