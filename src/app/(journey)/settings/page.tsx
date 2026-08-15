import Link from "next/link";

import { AppShell } from "@/components/app-shell/app-shell";
import { ResetControl } from "@/components/settings/reset-control";
import styles from "../journey.module.css";

// index.htmlモック(data-screen="settings")の構成をそのまま採用する。
// 通知トグルはモックと同じく表示のみで、挙動には影響しない(ネイティブcheckboxなので
// クライアント側スクリプトは不要)。
export default function SettingsPage() {
  return (
    <AppShell activeTab="settings" showNavigation>
      <h1 className={styles.title}>設定</h1>

      <section className={styles.card}>
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel} htmlFor="settings-notify">通知を受け取る</label>
          <input id="settings-notify" role="switch" type="checkbox" />
        </div>
        <p className={styles.note}>※デモでは表示のみで、通知の挙動は変わりません。</p>
      </section>

      <nav aria-label="ヘルプ" className={styles.list}>
        <Link className={styles.listItem} href="/privacy">
          <span>プライバシーについて</span>
          <span aria-hidden="true">&gt;</span>
        </Link>
        <Link className={styles.listItem} href="/faq">
          <span>よくある質問</span>
          <span aria-hidden="true">&gt;</span>
        </Link>
      </nav>

      <ResetControl />
    </AppShell>
  );
}
