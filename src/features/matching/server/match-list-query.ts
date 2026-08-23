import { requireUser } from "@/features/identity/server/session";
import type { MatchRunStatus } from "@/features/matching/server/journey-state";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ConnectionState } from "@/features/connection/server/queries";
import { anonymizePreConsentText } from "@/lib/ai/pre-consent-identity";

export type CompatibilityAxis =
  | "conversation_flow"
  | "values_alignment"
  | "humor_fit"
  | "mutual_interest"
  | "mismatch_severity";

export type MatchSummary = {
  matchRunId: string;
  status: MatchRunStatus;
  candidateAlias: string;
  overallScore: number | null;
  summary: string | null;
  decision: "accept" | "decline" | null;
  connectionState: ConnectionState | null;
  // 軸ごとの相性スコア。完了していないrunや取得できない場合は空配列。
  // 一覧で「相性スコアだけでなく何が違うのか」を軸ごとに比較できるようにするため(不具合3対応)。
  dimensions: Array<{ axis: CompatibilityAxis; score: number }>;
};

export type OwnedMatchSummaries = {
  summaries: MatchSummary[];
  acceptedMatchRunId: string | null;
};

type MatchRunRow = { id: string; candidate_id: string; status: MatchRunStatus };
type ReportRow = { id: string; match_run_id: string; overall_score: number; summary: string };
type DimensionRow = { report_id: string; axis: CompatibilityAxis; score: number };
type DecisionRow = { match_run_id: string; kind: "accept" | "decline" };
type ConnectionRow = { match_run_id: string; state: ConnectionState };

// マッチ結果一覧(/matches)向けに、利用者が持つ全run(最大3件)を候補アバターの
// 非識別ラベル・相性スコア・総評・自身の決定と合わせて返す。承諾は1利用者1件までのため、
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

  const completedRunIds = runRows.filter((run) => run.status === "completed").map((run) => run.id);
  const runIds = runRows.map((run) => run.id);

  const [reportsResult, decisionsResult, connectionsResult] = await Promise.all([
    completedRunIds.length > 0
      ? client.from("compatibility_reports").select("id, match_run_id, overall_score, summary")
        .eq("owner_id", userId).in("match_run_id", completedRunIds)
      : Promise.resolve({ data: [] as ReportRow[], error: null }),
    client.from("decisions").select("match_run_id, kind").eq("owner_id", userId).in("match_run_id", runIds),
    client.from("match_connections").select("match_run_id, state").eq("owner_id", userId).in("match_run_id", runIds),
  ]);
  if (reportsResult.error) throw reportsResult.error;
  if (decisionsResult.error) throw decisionsResult.error;
  if (connectionsResult.error) throw connectionsResult.error;

  const reportRows = (reportsResult.data ?? []) as ReportRow[];
  const reportIds = reportRows.map((report) => report.id);
  const dimensionsResult = reportIds.length > 0
    ? await client.from("compatibility_dimensions").select("report_id, axis, score")
      .eq("owner_id", userId).in("report_id", reportIds)
    : { data: [] as DimensionRow[], error: null };
  if (dimensionsResult.error) throw dimensionsResult.error;

  const reportByRunId = new Map(reportRows.map((row) => [row.match_run_id, row]));
  const dimensionsByReportId = new Map<string, Array<{ axis: CompatibilityAxis; score: number }>>();
  for (const row of (dimensionsResult.data ?? []) as DimensionRow[]) {
    const list = dimensionsByReportId.get(row.report_id) ?? [];
    list.push({ axis: row.axis, score: row.score });
    dimensionsByReportId.set(row.report_id, list);
  }
  const decisionByRunId = new Map(
    ((decisionsResult.data ?? []) as DecisionRow[]).map((row) => [row.match_run_id, row.kind]),
  );
  const connectionByRunId = new Map(
    ((connectionsResult.data ?? []) as ConnectionRow[]).map((row) => [row.match_run_id, row.state]),
  );

  const acceptedMatchRunId = [...connectionByRunId.entries()]
    .find(([, state]) => state !== "closed")?.[0] ?? null;

  const summaries = runRows.map((run, index): MatchSummary => {
    const report = reportByRunId.get(run.id);
    return {
      matchRunId: run.id,
      status: run.status,
      candidateAlias: `候補 ${index + 1}`,
      overallScore: report?.overall_score ?? null,
      summary: report ? anonymizePreConsentText(report.summary) : null,
      decision: decisionByRunId.get(run.id) ?? null,
      connectionState: connectionByRunId.get(run.id) ?? null,
      dimensions: report ? (dimensionsByReportId.get(report.id) ?? []) : [],
    };
  });

  return { summaries, acceptedMatchRunId };
}
