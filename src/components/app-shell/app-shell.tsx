import type { ReactNode } from "react";

import { BottomNav } from "./bottom-nav";
import styles from "./app-shell.module.css";

export type AppTab = "home" | "mypage" | "notifications" | "settings" | "chat";

type AppShellProps = {
  children: ReactNode;
  activeTab?: AppTab;
  header?: ReactNode;
  showNavigation?: boolean;
};

export function AppShell({
  children,
  activeTab = "home",
  header,
  showNavigation = false,
}: AppShellProps) {
  return (
    <div className={styles.stage}>
      <section aria-label="アプリ画面" className={styles.phone}>
        {header ? <header className={styles.header}>{header}</header> : null}
        <main className={styles.main}>{children}</main>
        {showNavigation ? <BottomNav activeTab={activeTab} /> : null}
      </section>
    </div>
  );
}
