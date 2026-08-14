import { AppShell } from "@/components/app-shell/app-shell";
import { MatchingProgress } from "@/features/matching/client/matching-progress";
import { startMatch } from "@/features/matching/server/actions";

export default async function MatchingPage() {
  const result = await startMatch();
  return (
    <AppShell activeTab="home" showNavigation>
      {result.ok
        ? <MatchingProgress initialStatus={result.data.status} matchRunId={result.data.matchRunId} />
        : <p role="alert">{result.error.message}</p>}
    </AppShell>
  );
}
