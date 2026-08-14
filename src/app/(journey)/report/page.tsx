import { AppShell } from "@/components/app-shell/app-shell";
import { CompatibilityReport } from "@/components/report/compatibility-report";
import { getOwnedCompletedReport } from "@/features/matching/server/report-query";

export default async function ReportPage({ searchParams }: { searchParams: Promise<{ matchRunId?: string }> }) {
  const { matchRunId } = await searchParams;
  if (!matchRunId) {
    return <AppShell activeTab="home" showNavigation><p role="alert">表示できる相性レポートがありません。</p></AppShell>;
  }
  const data = await getOwnedCompletedReport(matchRunId);
  return <AppShell activeTab="home" showNavigation><CompatibilityReport {...data} /></AppShell>;
}
