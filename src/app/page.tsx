import { AppShell } from "@/components/app-shell/app-shell";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <AppShell
      activeTab="home"
      header={<h1 className={styles.title}>アバターマッチング</h1>}
      showNavigation
    >
      <p className={styles.copy}>画面を準備しています。</p>
    </AppShell>
  );
}
