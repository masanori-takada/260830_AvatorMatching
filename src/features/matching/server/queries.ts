import type { MatchInput } from "@/lib/ai/types";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type AnswerRow = { question_code: `q${string}`; answer: string; revision: number };
type ProfileRow = { summary: string; traits: Record<string, string> };
type CandidateRow = { avatar_alias: string; conversation_profile: Record<string, unknown> };

export async function getOwnedMatchInput(
  client: ServerClient,
  matchRunId: string,
  ownerId: string,
): Promise<MatchInput> {
  const { data: run, error: runError } = await client.from("match_runs")
    .select("candidate_id").eq("id", matchRunId).eq("owner_id", ownerId).single();
  if (runError || !run) throw runError ?? new Error("MATCH_NOT_FOUND");

  const { data: answers, error: answersError } = await client.from("interview_answers")
    .select("question_code, answer, revision").eq("owner_id", ownerId).order("question_code");
  if (answersError || !answers || answers.length !== 20) throw answersError ?? new Error("INTERVIEW_INCOMPLETE");

  const { data: profile, error: profileError } = await client.from("avatar_profiles")
    .select("summary, traits").eq("owner_id", ownerId).single();
  if (profileError || !profile) throw profileError ?? new Error("PROFILE_NOT_FOUND");

  const { data: candidate, error: candidateError } = await client.from("demo_candidates")
    .select("avatar_alias, conversation_profile").eq("id", run.candidate_id).eq("active", true).single();
  if (candidateError || !candidate) throw candidateError ?? new Error("CANDIDATE_NOT_FOUND");

  return {
    answers: (answers as AnswerRow[]).map((answer) => ({
      questionCode: answer.question_code, answer: answer.answer, revision: answer.revision,
    })),
    profile: {
      summary: (profile as ProfileRow).summary,
      traits: (profile as ProfileRow).traits,
    },
    candidate: {
      avatarAlias: (candidate as CandidateRow).avatar_alias,
      conversationProfile: (candidate as CandidateRow).conversation_profile,
    },
  };
}
