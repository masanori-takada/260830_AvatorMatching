"use server";

import { ZodError } from "zod";

import { requireUser } from "@/features/identity/server/session";
import { INTERVIEW_QUESTIONS } from "@/features/interview/domain";
import { InterviewAnswerValidationError, parseInterviewAnswer } from "@/features/interview/schemas";
import { getAiProvider } from "@/lib/ai/provider";
import { avatarProfileOutputSchema } from "@/lib/ai/schemas";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AnswerRow = {
  question_code: `q${string}`;
  answer: string;
  revision: number;
};

type StoredProfile = {
  summary: string;
  traits: Record<string, string>;
  source_revision: number;
  provider: string;
};

export async function completeInterview(): Promise<ActionResult<{
  summary: string;
  sourceRevision: number;
}>> {
  try {
    const { userId } = await requireUser();
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("interview_answers")
      .select("question_code, answer, revision")
      .eq("owner_id", userId)
      .order("question_code");

    if (error) {
      throw error;
    }

    const answers = (data ?? []) as AnswerRow[];
    if (
      answers.length !== 20
      || answers.some((answer, index) => answer.question_code !== INTERVIEW_QUESTIONS[index]?.code)
    ) {
      return failure("VALIDATION_ERROR", "20問すべてに回答してください。", false);
    }

    let normalizedAnswers;
    try {
      normalizedAnswers = answers.map((answer, index) => ({
        questionCode: answer.question_code,
        answer: parseInterviewAnswer(INTERVIEW_QUESTIONS[index]!, answer.answer),
        revision: answer.revision,
      }));
    } catch (error) {
      if (error instanceof InterviewAnswerValidationError) {
        return failure("VALIDATION_ERROR", "保存済み回答に不正な値があります。", false);
      }
      throw error;
    }

    const provider = getAiProvider();
    const output = avatarProfileOutputSchema.parse(await provider.generateProfile({
      answers: normalizedAnswers,
    }));
    const sourceRevision = answers.reduce((sum, answer) => sum + answer.revision, 0);
    const { data: existingData, error: existingError } = await supabase
      .from("avatar_profiles")
      .select("summary, traits, source_revision, provider")
      .eq("owner_id", userId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }
    const existing = existingData as StoredProfile | null;
    const sameTraits = existing
      ? Object.entries(output.traits).every(([key, value]) => existing.traits[key] === value)
        && Object.keys(existing.traits).length === Object.keys(output.traits).length
      : false;
    if (
      existing
      && existing.summary === output.summary
      && sameTraits
      && existing.source_revision === sourceRevision
      && existing.provider === provider.providerId
    ) {
      return success({ summary: output.summary, sourceRevision });
    }

    const { error: saveError } = await supabase.rpc("upsert_my_avatar_profile", {
      p_summary: output.summary,
      p_traits: output.traits,
      p_source_revision: sourceRevision,
      p_provider: provider.providerId,
    });

    if (saveError) {
      throw saveError;
    }
    return success({ summary: output.summary, sourceRevision });
  } catch (error) {
    if (error instanceof ZodError) {
      logError("avatar_profile_invalid_provider_output", { issueCount: error.issues.length });
      return failure("VALIDATION_ERROR", "アバター要約を検証できませんでした。", false);
    }
    const actionError = toActionError(error);
    if (actionError.code === "INTERNAL_ERROR") {
      // SupabaseのエラーはError型ではなくcodeを持つオブジェクトなので、原因追跡のため
      // 回答本文を含まない識別子だけを残す。
      const details = error as { name?: string; code?: string } | null;
      logError("avatar_profile_completion_failed", {
        errorName: details?.name,
        errorCode: details?.code,
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
