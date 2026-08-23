import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { NotificationCard } from "@/components/notifications/notification-card";
import { getOwnedNotifications, markNotificationRead } from "@/features/notifications/server/queries";
import { notificationHref } from "@/features/notifications/route";
import styles from "../journey.module.css";

export default async function NotificationsPage() {
  const notifications = await getOwnedNotifications();
  return (
    <AppShell activeTab="notifications" showNavigation>
      <h1 className={styles.title}>お知らせ</h1>
      {notifications.length === 0 ? <p className={styles.empty}>まだお知らせはありません。アバターが会話を続けています。</p> : (
        <div className={styles.stack}>
          {notifications.map((item) => (
            <NotificationCard
              action={async () => {
                "use server";
                await markNotificationRead(item.id);
                revalidatePath("/notifications");
                const href = notificationHref(item);
                if (href) redirect(href);
              }}
              item={item}
              key={item.id}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
