import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getOwnedMatchSummaries, type MatchSummary } from "@/features/matching/server/match-list-query";
import styles from "./matches.module.css";

// 「自分のアバターが複数の相手と勝手に会話してきてくれた」という体験の到達点。
// 完了した候補を並べ、それぞれの相性スコアと総評から気になる相手を選べるようにする。
export default async function MatchesPage() {
  const { summaries, acceptedMatchRunId } = await getOwnedMatchSummaries();
  const hasCompleted = summaries.some((match) => match.status === "completed");
  if (summaries.length === 0 || !hasCompleted) {
    redirect("/matching");
  }

  return (
    <AppShell activeTab="home" showNavigation>
      <h1 className={styles.title}>マッチ結果</h1>
      <p className={styles.lead}>
        あなたのアバターが{summaries.length}人の候補アバターと会話しました。気になるお相手を選んで、会話ログと相性レポートを確認してください。
      </p>
      <ul className={styles.list}>
        {summaries.map((match) => (
          <li key={match.matchRunId}>
            <MatchCard acceptedElsewhere={acceptedMatchRunId !== null && acceptedMatchRunId !== match.matchRunId} match={match} />
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

function MatchCard({ match, acceptedElsewhere }: { match: MatchSummary; acceptedElsewhere: boolean }) {
  if (match.status !== "completed") {
    return (
      <div className={`${styles.card} ${styles.pending}`}>
        <span aria-hidden="true" className={styles.avatar}>A</span>
        <div className={styles.body}>
          <p className={styles.name}>{match.status === "failed" ? "会話に失敗した候補" : "会話中の候補"}</p>
          <p className={styles.note}>
            {match.status === "failed" ? "この候補との会話は完了しませんでした。" : "もうすぐ会話が終わります。"}
          </p>
        </div>
      </div>
    );
  }

  if (acceptedElsewhere) {
    return (
      <div className={`${styles.card} ${styles.disabled}`}>
        <span aria-hidden="true" className={styles.avatar}>A</span>
        <div className={styles.body}>
          <p className={styles.name}>{match.candidateAlias}</p>
          <p className={styles.note}>他の方を承諾したため、見送りになりました。</p>
        </div>
      </div>
    );
  }

  const decisionLabel = match.decision === "accept" ? "承諾済み" : match.decision === "decline" ? "辞退済み" : null;

  return (
    <Link className={styles.card} href={`/report?matchRunId=${match.matchRunId}`}>
      <span aria-hidden="true" className={styles.avatar}>A</span>
      <div className={styles.body}>
        <div className={styles.headRow}>
          <p className={styles.name}>{match.candidateAlias}</p>
          <span className={styles.badge}>相性 {match.overallScore}%</span>
        </div>
        {match.summary ? <p className={styles.summary}>{match.summary}</p> : null}
        {decisionLabel ? <p className={styles.note}>{decisionLabel}</p> : null}
      </div>
    </Link>
  );
}
