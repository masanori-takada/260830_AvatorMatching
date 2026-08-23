import { requireUser } from "@/features/identity/server/session";
import type { CompatibilityDimension } from "@/components/report/compatibility-report";
import type { ConversationMessage } from "@/components/report/conversation-log";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { anonymizePreConsentText } from "@/lib/ai/pre-consent-identity";

export async function getOwnedCompletedReport(matchRunId: string) {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data: run, error: runError } = await client.from("match_runs")
    .select("id, status").eq("id", matchRunId).eq("owner_id", userId).eq("status", "completed").single();
  if (runError || !run) throw runError ?? new Error("REPORT_NOT_FOUND");

  const [reportResult, messagesResult] = await Promise.all([
    client.from("compatibility_reports").select("id, overall_score, summary, caution").eq("match_run_id", matchRunId).eq("owner_id", userId).single(),
    client.from("conversation_messages").select("id, turn_index, speaker, body, answer_refs").eq("match_run_id", matchRunId).eq("owner_id", userId).order("turn_index"),
  ]);
  if (reportResult.error || messagesResult.error || !reportResult.data || !messagesResult.data) {
    throw reportResult.error ?? messagesResult.error ?? new Error("REPORT_INCOMPLETE");
  }
  const { data: dimensions, error: dimensionsError } = await client.from("compatibility_dimensions")
    .select("axis, score, explanation, evidence_message_id").eq("report_id", reportResult.data.id).eq("owner_id", userId).order("axis");
  if (dimensionsError || !dimensions || dimensions.length !== 5 || messagesResult.data.length < 8) {
    throw dimensionsError ?? new Error("REPORT_INCOMPLETE");
  }

  return {
    candidateAlias: "候補アバター",
    report: {
      overallScore: reportResult.data.overall_score as number,
      summary: anonymizePreConsentText(reportResult.data.summary as string),
      caution: anonymizePreConsentText(reportResult.data.caution as string),
    },
    messages: messagesResult.data.map((message): ConversationMessage => ({
      id: message.id, turnIndex: message.turn_index, speaker: message.speaker,
      body: anonymizePreConsentText(message.body), answerRefs: message.answer_refs,
    })),
    dimensions: dimensions.map((dimension): CompatibilityDimension => ({
      axis: dimension.axis,
      score: dimension.score,
      explanation: anonymizePreConsentText(dimension.explanation),
      evidenceMessageId: dimension.evidence_message_id,
    })),
  };
}
