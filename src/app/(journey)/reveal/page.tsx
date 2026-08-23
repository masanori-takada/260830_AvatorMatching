import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { CandidatePhoto } from "@/components/candidate/candidate-photo";
import { ContactDecision } from "@/components/connection/contact-decision";
import { getCandidateReveal, getCurrentCandidateReveal } from "@/features/decision/server/queries";
import { getOwnedConnection } from "@/features/connection/server/queries";
import styles from "../journey.module.css";

export default async function RevealPage({ searchParams }: { searchParams: Promise<{ matchRunId?: string }> }) {
  const { matchRunId } = await searchParams;
  const reveal = matchRunId ? await getCandidateReveal(matchRunId) : await getCurrentCandidateReveal();
  if (!reveal) redirect("/");
  const connection = await getOwnedConnection(reveal.matchRunId);
  if (!connection || connection.state === "closed") redirect("/matches");

  return (
    <AppShell activeTab="home" showNavigation>
      <h1 className={styles.title}>承諾後のプロフィール</h1>
      <section className={styles.empty}>
        <CandidatePhoto alt={`${reveal.firstName}の写真`} size="large" src={reveal.photoPath} />
        <p>以下はAI生成の完全な架空プロフィールです。</p>
        <h2>{reveal.firstName}</h2>
        <p>{reveal.ageRange}</p>
        <p>{reveal.interests.join("・")}</p>
        <p>{reveal.bio}</p>
      </section>
      {connection.state === "profile_revealed" || connection.state === "contact_pending" ? (
        <ContactDecision connectionId={connection.id} />
      ) : null}
      {connection.state === "connected" ? <a href="/chat">チャットを開く</a> : null}
    </AppShell>
  );
}
