import Link from "next/link";

import { AppShell } from "@/components/app-shell/app-shell";
import { NoticeList } from "@/components/home/notice-list";
import { StatusCard } from "@/components/home/status-card";
import styles from "@/components/home/home.module.css";
import { requireUser } from "@/features/identity/server/session";
import { deriveJourneyState, getJourneySnapshot } from "@/features/matching/server/journey-state";
import { getOwnedNotifications } from "@/features/notifications/server/queries";

type MenuItem = {
  href: string;
  icon: "doc" | "shield" | "help" | "gear";
  label: string;
};

// 既存デモのメニューグリッド(会話ログ・レポート/プライバシー/FAQ/設定)を再現する。
const MENU_ITEMS: readonly MenuItem[] = [
  { href: "/report", icon: "doc", label: "会話ログ・相性レポート" },
  { href: "/privacy", icon: "shield", label: "プライバシーについて" },
  { href: "/faq", icon: "help", label: "よくある質問" },
  { href: "/settings", icon: "gear", label: "設定" },
];

export default async function HomePage() {
  const { userId } = await requireUser();
  const [snapshot, notifications] = await Promise.all([
    getJourneySnapshot(userId),
    getOwnedNotifications(),
  ]);
  const journey = deriveJourneyState(snapshot);

  return (
    <AppShell activeTab="home" showNavigation>
      <div className={styles.hero}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>AIが代わりに会っている。</h1>
          <p className={styles.heroLead}>
            あなたのAIアバターが相手のアバターと会話し、相性を確かめています。
          </p>
        </div>
        <svg
          aria-hidden="true"
          className={styles.heroIcon}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.4}
          viewBox="0 0 24 24"
        >
          <circle cx="8" cy="8.5" r="3.2" />
          <circle cx="16" cy="8.5" r="3.2" />
          <path d="M2.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
          <path d="M10.5 20c0-3 2.5-4.8 5.5-4.8s5.5 1.8 5.5 4.8" />
        </svg>
      </div>

      <StatusCard journey={journey} />
      <NoticeList notifications={notifications} />

      <div className={styles.menuGrid}>
        {MENU_ITEMS.map((item) => (
          <Link className={styles.menuItem} href={item.href} key={item.href}>
            <span aria-hidden="true" className={styles.iconCircle}>
              <MenuIcon name={item.icon} />
            </span>
            <span className={styles.menuItemLabel}>{item.label}</span>
          </Link>
        ))}
      </div>

      <Link className={styles.banner} href="/privacy">
        <span aria-hidden="true" className={styles.iconCircle}>
          <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
            <rect height="10" rx="2.5" width="15" x="4.5" y="10" />
            <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
          </svg>
        </span>
        <span className={styles.bannerBody}>
          <span className={styles.cardTitle}>安心・匿名の設計</span>
          <span className={styles.bodyText}>
            下の名前・年齢層・趣味・自己紹介文・AI生成の架空写真だけを段階的に開示します。姓や所属、連絡先は表示しません。
          </span>
        </span>
      </Link>
    </AppShell>
  );
}

function MenuIcon({ name }: { name: MenuItem["icon"] }) {
  if (name === "doc") {
    return (
      <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6" />
        <path d="M9 17h4" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
        <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    );
  }

  if (name === "help") {
    return (
      <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.7.2-1.2.9-1.2 1.6v.5" />
        <path d="M12 17.2h.01" />
      </svg>
    );
  }

  return (
    <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5" />
      <path d="M12 18.5V21" />
      <path d="M3 12h2.5" />
      <path d="M18.5 12H21" />
      <path d="M5.6 5.6l1.8 1.8" />
      <path d="M16.6 16.6l1.8 1.8" />
      <path d="M18.4 5.6l-1.8 1.8" />
      <path d="M7.4 16.6l-1.8 1.8" />
    </svg>
  );
}
