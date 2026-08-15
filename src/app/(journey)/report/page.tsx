import Link from "next/link";

import { AppShell } from "@/components/app-shell/app-shell";
import { DecisionDialog } from "@/components/feedback/decision-dialog";
import { CompatibilityReport } from "@/components/report/compatibility-report";
import { getOwnedDecision } from "@/features/decision/server/queries";
import { getOwnedCompletedReport } from "@/features/matching/server/report-query";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ matchRunId?: string }> }) {
  const { matchRunId } = await searchParams;
  if (!matchRunId) {
    return <AppShell activeTab="home" showNavigation><p role="alert">表示できる相性レポートがありません。</p></AppShell>;
  }
  const [data, decision] = await Promise.all([
    getOwnedCompletedReport(matchRunId),
    getOwnedDecision(matchRunId),
  ]);
  return (
    <AppShell activeTab="home" showNavigation>
      <CompatibilityReport {...data} />
      {decision === null ? <DecisionDialog matchRunId={matchRunId} /> : null}
      {decision === "accept" ? <Link href="/reveal">承諾済みの開示情報を見る</Link> : null}
      {decision === "decline" ? <Link href="/declined">辞退済みの結果を見る</Link> : null}
    </AppShell>
  );
}
