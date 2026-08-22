import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { MatchingProgress } from "@/features/matching/client/matching-progress";
import { requireUser } from "@/features/identity/server/session";
import { startMatch } from "@/features/matching/server/actions";
import { deriveJourneyState, getJourneySnapshot } from "@/features/matching/server/journey-state";

export default async function MatchingPage() {
  // ホームと同じ導出ロジックで現在地を確認し、インタビュー未完了なら次の質問へ戻す。
  const { userId } = await requireUser();
  const snapshot = await getJourneySnapshot(userId);
  const journey = deriveJourneyState(snapshot);
  if (!journey.allowedPaths.includes("/matching")) {
    redirect(journey.primaryAction.href);
  }

  const result = await startMatch();
  return (
    <AppShell activeTab="home" showNavigation>
      {result.ok
        ? <MatchingProgress matches={result.data.matches} />
        : <p role="alert">{result.error.message}</p>}
    </AppShell>
  );
}
