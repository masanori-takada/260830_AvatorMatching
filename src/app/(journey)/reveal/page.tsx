import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getCurrentCandidateReveal } from "@/features/decision/server/queries";
import styles from "../journey.module.css";

export default async function RevealPage() {
  const reveal = await getCurrentCandidateReveal();
  if (!reveal) redirect("/");

  return (
    <AppShell activeTab="home" showNavigation>
      <h1 className={styles.title}>承諾後のプロフィール</h1>
      <section className={styles.empty}>
        <p>以下は本デモ用の完全な架空情報です。</p>
        <h2>{reveal.fullName}</h2>
        <p>{reveal.company}・{reveal.department}</p>
        <p>{reveal.bio}</p>
      </section>
    </AppShell>
  );
}
