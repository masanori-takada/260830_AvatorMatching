import { AppShell } from "@/components/app-shell/app-shell";
import { MatchingProgress } from "@/features/matching/client/matching-progress";
import { startMatch } from "@/features/matching/server/actions";

export default async function MatchingPage() {
  const result = await startMatch();
  return (
    <AppShell activeTab="home" showNavigation>
      {result.ok
        ? <MatchingProgress matches={result.data.matches} />
        : <p role="alert">{result.error.message}</p>}
    </AppShell>
  );
}
