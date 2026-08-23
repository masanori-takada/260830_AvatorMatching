import Link from "next/link";

import { AppShell } from "@/components/app-shell/app-shell";
import { DecisionDialog } from "@/components/feedback/decision-dialog";
import { CompatibilityReport } from "@/components/report/compatibility-report";
import { getOwnedAcceptedMatchRunId, getOwnedConnectionState, getOwnedDecision } from "@/features/decision/server/queries";
import { getOwnedCompletedReport } from "@/features/matching/server/report-query";
import styles from "@/components/report/report.module.css";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ matchRunId?: string }> }) {
  const { matchRunId } = await searchParams;
  if (!matchRunId) {
    return <AppShell activeTab="home" showNavigation><p role="alert">表示できる相性レポートがありません。</p></AppShell>;
  }
  const [data, decision, acceptedMatchRunId, connectionState] = await Promise.all([
    getOwnedCompletedReport(matchRunId),
    getOwnedDecision(matchRunId),
    getOwnedAcceptedMatchRunId(),
    getOwnedConnectionState(matchRunId),
  ]);
  // 承諾は1利用者につき1件まで(SC-006)。別の候補をすでに承諾している場合、
  // この候補はもう選べないことを画面上でも分かるようにする(未決定の候補に限る)。
  const acceptedElsewhere = decision === null && acceptedMatchRunId !== null && acceptedMatchRunId !== matchRunId;
  return (
    <AppShell activeTab="home" showNavigation>
      <CompatibilityReport {...data} />
      {decision === null && !acceptedElsewhere ? <DecisionDialog matchRunId={matchRunId} /> : null}
      {acceptedElsewhere ? (
        <p className={styles.note} role="status">
          他の方を承諾したため、この候補は選べません。<Link href="/matches">マッチ結果に戻る</Link>
        </p>
      ) : null}
      {decision === "accept" && (connectionState === "profile_revealed" || connectionState === "contact_pending") ? (
        <Link href={`/reveal?matchRunId=${encodeURIComponent(matchRunId)}`}>承諾済みの開示情報を見る</Link>
      ) : null}
      {decision === "accept" && connectionState === "connected" ? <Link href="/chat">チャットを開く</Link> : null}
      {decision === "accept" && connectionState === "closed" ? (
        <p className={styles.note} role="status">
          今回は見送りました。別の候補を選べます。 <Link href="/matches">別の候補を選ぶ</Link>
        </p>
      ) : null}
      {decision === "decline" ? <Link href="/declined">辞退済みの結果を見る</Link> : null}
    </AppShell>
  );
}
