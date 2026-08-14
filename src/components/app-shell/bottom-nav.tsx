import type { AppTab } from "./app-shell";
import styles from "./app-shell.module.css";

type BottomNavProps = {
  activeTab: AppTab;
};

type NavigationItem = {
  href: string;
  icon: "home" | "mypage" | "notifications" | "settings";
  label: string;
  tab: AppTab;
};

const navigationItems: NavigationItem[] = [
  { tab: "home", label: "ホーム", href: "/", icon: "home" },
  { tab: "mypage", label: "マイページ", href: "/mypage", icon: "mypage" },
  {
    tab: "notifications",
    label: "お知らせ",
    href: "/notifications",
    icon: "notifications",
  },
  { tab: "settings", label: "設定", href: "/settings", icon: "settings" },
];

export function BottomNav({ activeTab }: BottomNavProps) {
  return (
    <nav aria-label="メインナビゲーション" className={styles.navigation}>
      {navigationItems.map((item) => (
        <a
          aria-current={item.tab === activeTab ? "page" : undefined}
          className={styles.tab}
          href={item.href}
          key={item.tab}
        >
          <NavigationIcon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

function NavigationIcon({ name }: { name: NavigationItem["icon"] }) {
  if (name === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" />
        <path d="M9 21v-7h6v7" />
      </svg>
    );
  }

  if (name === "mypage") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    );
  }

  if (name === "notifications") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 22h4" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.08h-3v-.08A1.7 1.7 0 0 0 10.68 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06-2.12-2.12.06-.06A1.7 1.7 0 0 0 7.02 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-3h.08A1.7 1.7 0 0 0 7.02 9.94a1.7 1.7 0 0 0-.34-1.88l-.06-.06L8.74 5.88l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h3v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 8l-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.08v3h-.08A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  );
}
