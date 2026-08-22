"use server";

import { ZodError } from "zod";

import { requireUser } from "@/features/identity/server/session";
import {
  filterDisclosableAnswers,
  INTERVIEW_QUESTIONS_BY_CODE,
  TOTAL_QUESTIONS,
  type SensitiveGroup,
} from "@/features/interview/domain";
import { InterviewAnswerValidationError, parseInterviewAnswer } from "@/features/interview/schemas";
import { AiProviderError } from "@/lib/ai/generation";
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

    // interview_answersは question_code (テキスト) 昇順で取得しているため、
    // INTERVIEW_QUESTIONS_BY_CODE(コード昇順)とインデックス対応させて比較できる。
    const answers = (data ?? []) as AnswerRow[];
    if (
      answers.length !== TOTAL_QUESTIONS
      || answers.some((answer, index) => answer.question_code !== INTERVIEW_QUESTIONS_BY_CODE[index]?.code)
    ) {
      return failure("VALIDATION_ERROR", `${TOTAL_QUESTIONS}問すべてに回答してください。`, false);
    }

    let normalizedAnswers;
    try {
      normalizedAnswers = answers.map((answer, index) => ({
        questionCode: answer.question_code,
        answer: parseInterviewAnswer(INTERVIEW_QUESTIONS_BY_CODE[index]!, answer.answer),
        revision: answer.revision,
      }));
    } catch (error) {
      if (error instanceof InterviewAnswerValidationError) {
        return failure("VALIDATION_ERROR", "保存済み回答に不正な値があります。", false);
      }
      throw error;
    }

    // アバター要約は特定の相手(候補者)を前提とせずに一度だけ生成し、以後すべてのマッチで
    // 使い回される(src/features/matching/server/queries.tsのgetOwnedMatchInputが毎回参照する)。
    // 開示可否は「本人と相手の双方の同意」で決まる相手ペア依存の判断のため、
    // まだ相手が定まらないこの時点ではデリケートな回答(および開示意思の回答そのもの)を
    // 一切含めない。空集合をfilterDisclosableAnswersへ渡すことで、
    // デリケートな質問はすべて除外される(同意状況にかかわらず安全側に倒す)。
    const noConsentGroups: ReadonlySet<SensitiveGroup> = new Set();
    const provider = getAiProvider();
    const output = avatarProfileOutputSchema.parse(await provider.generateProfile({
      answers: filterDisclosableAnswers(normalizedAnswers, noConsentGroups, noConsentGroups),
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
      // AiProviderError(openai-provider.ts/gemini-provider.ts/generation.ts)なら、
      // provider種別・失敗種別・HTTPステータス・APIのエラー種別/コードを構造化して残す(FR-040)。
      // それ以外(SupabaseのエラーはError型ではなくcodeを持つオブジェクト等)は
      // 従来どおりname/codeだけを残す。どちらも回答本文・APIキーは含まない。
      const details = error as { name?: string; code?: string } | null;
      logError("avatar_profile_completion_failed", {
        errorName: details?.name,
        errorCode: details?.code,
        ...(error instanceof AiProviderError ? error.diagnostics : {}),
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
