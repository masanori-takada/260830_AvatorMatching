"use server";

import { ZodError } from "zod";

import { requireUser } from "@/features/identity/server/session";
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
    const expectedCodes = Array.from(
      { length: 20 },
      (_, index) => `q${String(index + 1).padStart(2, "0")}`,
    );
    if (
      answers.length !== 20
      || answers.some((answer, index) => answer.question_code !== expectedCodes[index])
    ) {
      return failure("VALIDATION_ERROR", "20問すべてに回答してください。", false);
    }

    const provider = getAiProvider();
    const output = avatarProfileOutputSchema.parse(await provider.generateProfile({
      answers: answers.map((answer) => ({
        questionCode: answer.question_code,
        answer: answer.answer,
        revision: answer.revision,
      })),
    }));
    const sourceRevision = answers.reduce((sum, answer) => sum + answer.revision, 0);
    const { error: saveError } = await supabase.from("avatar_profiles").upsert({
      owner_id: userId,
      summary: output.summary,
      traits: output.traits,
      source_revision: sourceRevision,
      provider: "mock-v1",
    }, { onConflict: "owner_id" });

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
      logError("avatar_profile_completion_failed", { errorName: (error as Error)?.name });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
