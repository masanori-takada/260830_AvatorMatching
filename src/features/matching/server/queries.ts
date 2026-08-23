import {
  CONSENT_QUESTION_CODE_BY_GROUP,
  filterDisclosableAnswers,
  isDisclosureConsentGiven,
  TOTAL_QUESTIONS,
  type SensitiveGroup,
} from "@/features/interview/domain";
import type { MatchInput } from "@/lib/ai/types";
import { anonymizePreConsentValue } from "@/lib/ai/pre-consent-identity";
import type { createServerSupabaseClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

type AnswerRow = { question_code: `q${string}`; answer: string; revision: number };
type CandidateRow = {
  conversation_profile: Record<string, unknown>;
  disclosure_consent_groups: string[];
};

/** 本人の回答から、開示OKとした開示グループの集合を導く。 */
function buildConsentGroups(answers: readonly AnswerRow[]): ReadonlySet<SensitiveGroup> {
  const groups = new Set<SensitiveGroup>();
  for (const [group, questionCode] of CONSENT_QUESTION_CODE_BY_GROUP) {
    const answer = answers.find((row) => row.question_code === questionCode);
    if (answer && isDisclosureConsentGiven(answer.answer)) {
      groups.add(group);
    }
  }
  return groups;
}

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
  if (answersError || !answers || answers.length !== TOTAL_QUESTIONS) throw answersError ?? new Error("INTERVIEW_INCOMPLETE");

  const { data: candidate, error: candidateError } = await client.from("demo_candidates")
    .select("conversation_profile, disclosure_consent_groups")
    .eq("id", run.candidate_id).eq("active", true).single();
  if (candidateError || !candidate) throw candidateError ?? new Error("CANDIDATE_NOT_FOUND");

  const typedAnswers = answers as AnswerRow[];
  const typedCandidate = candidate as CandidateRow;

  // デリケートな回答は、本人と相手の双方が対応する開示グループへ同意している場合だけ
  // AIへの入力に含める(src/features/interview/domain.tsのfilterDisclosableAnswersに一元化)。
  // ここで除外することで、AIへは最初から渡さない(プロンプト上の指示だけに頼らない)。
  const selfConsentGroups = buildConsentGroups(typedAnswers);
  const counterpartConsentGroups = new Set(typedCandidate.disclosure_consent_groups as SensitiveGroup[]);
  const disclosableAnswers = filterDisclosableAnswers(
    typedAnswers.map((answer) => ({
      questionCode: answer.question_code, answer: answer.answer, revision: answer.revision,
    })),
    selfConsentGroups,
    counterpartConsentGroups,
  );

  return {
    answers: disclosableAnswers,
    candidate: {
      conversationProfile: anonymizePreConsentValue(
        typedCandidate.conversation_profile,
      ) as Record<string, unknown>,
    },
  };
}
