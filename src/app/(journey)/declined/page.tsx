import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { hasCurrentDecline } from "@/features/decision/server/queries";
import styles from "../journey.module.css";

export default async function DeclinedPage() {
  if (!await hasCurrentDecline()) redirect("/");
  return (
    <AppShell activeTab="home" showNavigation>
      <h1 className={styles.title}>今回は見送りました</h1>
      <p className={styles.empty}>候補者の識別情報は開示されません。決定は安全に保存されています。</p>
    </AppShell>
  );
}
