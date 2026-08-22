import { requireUser } from "@/features/identity/server/session";
import type { MatchRunStatus } from "@/features/matching/server/journey-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type MatchSummary = {
  matchRunId: string;
  status: MatchRunStatus;
  candidateAlias: string;
  overallScore: number | null;
  summary: string | null;
  decision: "accept" | "decline" | null;
};

export type OwnedMatchSummaries = {
  summaries: MatchSummary[];
  acceptedMatchRunId: string | null;
};

type MatchRunRow = { id: string; candidate_id: string; status: MatchRunStatus };
type CandidateRow = { id: string; avatar_alias: string };
type ReportRow = { match_run_id: string; overall_score: number; summary: string };
type DecisionRow = { match_run_id: string; kind: "accept" | "decline" };

// マッチ結果一覧(/matches)向けに、利用者が持つ全run(最大3件)を候補アバターの
// エイリアス・相性スコア・総評・自身の決定と合わせて返す。承諾は1利用者1件までのため、
// acceptedMatchRunIdが立っていれば「他の候補はもう選べない」ことを画面側で示せる。
export async function getOwnedMatchSummaries(): Promise<OwnedMatchSummaries> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();

  const { data: runs, error: runsError } = await client
    .from("match_runs")
    .select("id, candidate_id, status")
    .eq("owner_id", userId)
    .order("candidate_id");
  if (runsError) throw runsError;

  const runRows = (runs ?? []) as MatchRunRow[];
  if (runRows.length === 0) {
    return { summaries: [], acceptedMatchRunId: null };
  }

  const candidateIds = [...new Set(runRows.map((run) => run.candidate_id))];
  const completedRunIds = runRows.filter((run) => run.status === "completed").map((run) => run.id);
  const runIds = runRows.map((run) => run.id);

  const [candidatesResult, reportsResult, decisionsResult] = await Promise.all([
    client.from("demo_candidates").select("id, avatar_alias").in("id", candidateIds),
    completedRunIds.length > 0
      ? client.from("compatibility_reports").select("match_run_id, overall_score, summary")
        .eq("owner_id", userId).in("match_run_id", completedRunIds)
      : Promise.resolve({ data: [] as ReportRow[], error: null }),
    client.from("decisions").select("match_run_id, kind").eq("owner_id", userId).in("match_run_id", runIds),
  ]);
  if (candidatesResult.error) throw candidatesResult.error;
  if (reportsResult.error) throw reportsResult.error;
  if (decisionsResult.error) throw decisionsResult.error;

  const aliasByCandidateId = new Map(
    ((candidatesResult.data ?? []) as CandidateRow[]).map((row) => [row.id, row.avatar_alias]),
  );
  const reportByRunId = new Map(
    ((reportsResult.data ?? []) as ReportRow[]).map((row) => [row.match_run_id, row]),
  );
  const decisionByRunId = new Map(
    ((decisionsResult.data ?? []) as DecisionRow[]).map((row) => [row.match_run_id, row.kind]),
  );

  const acceptedMatchRunId = [...decisionByRunId.entries()]
    .find(([, kind]) => kind === "accept")?.[0] ?? null;

  const summaries = runRows.map((run): MatchSummary => {
    const report = reportByRunId.get(run.id);
    return {
      matchRunId: run.id,
      status: run.status,
      candidateAlias: aliasByCandidateId.get(run.candidate_id) ?? "候補アバター",
      overallScore: report?.overall_score ?? null,
      summary: report?.summary ?? null,
      decision: decisionByRunId.get(run.id) ?? null,
    };
  });

  return { summaries, acceptedMatchRunId };
}
