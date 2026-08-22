"use server";

import { findInterviewQuestion, type SaveInterviewAnswerInput, type SaveInterviewAnswerOutput } from "@/features/interview/domain";
import { requireUser } from "@/features/identity/server/session";
import {
  InterviewAnswerValidationError,
  parseInterviewAnswer,
  saveInterviewAnswerInputSchema,
} from "@/features/interview/schemas";
import { identifyDbErrorCode } from "@/lib/db-error-codes";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type SavedAnswerRow = {
  revision: number;
  answered_count: number;
  next_question_order: number | null;
};

export async function saveInterviewAnswer(
  input: SaveInterviewAnswerInput,
): Promise<ActionResult<SaveInterviewAnswerOutput>> {
  try {
    await requireUser();
    const parsedInput = saveInterviewAnswerInputSchema.parse(input);
    const question = findInterviewQuestion(parsedInput.questionCode);

    if (!question) {
      return failure("VALIDATION_ERROR", "質問が見つかりません。", false);
    }

    const answer = parseInterviewAnswer(question, parsedInput.answer);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("save_interview_answer", {
      p_question_code: parsedInput.questionCode,
      p_answer: answer,
      p_expected_revision: parsedInput.expectedRevision,
    });

    if (error) {
      // save_interview_answer()が投げる識別子と完全一致した場合だけ分岐する(メッセージ本文の
      // 内容は保証されないためFR-040)。一致しなければ「不明」としてログに残す。
      const dbErrorId = identifyDbErrorCode(error.message);
      if (dbErrorId === "STATE_CONFLICT") {
        return failure(
          "STATE_CONFLICT",
          "回答が別の画面で更新されました。再読み込みしてお試しください。",
          false,
        );
      }
      if (dbErrorId === "INTERVIEW_LOCKED") {
        return failure("STATE_CONFLICT", "マッチング開始後は回答を変更できません。", false);
      }
      if (dbErrorId === "OUT_OF_ORDER") {
        return failure("STATE_CONFLICT", "回答順が更新されました。再読み込みしてお試しください。", false);
      }
      if (dbErrorId === "VALIDATION_ERROR") {
        return failure("VALIDATION_ERROR", "回答内容を確認してください。", false);
      }

      logError("interview_answer_save_failed", { errorCode: error.code, dbErrorId });
      return failure("INTERNAL_ERROR", "回答を保存できませんでした。もう一度お試しください。", true);
    }

    const row = (Array.isArray(data) ? data[0] : data) as SavedAnswerRow | undefined;
    if (!row) {
      logError("interview_answer_save_empty_result");
      return failure("INTERNAL_ERROR", "回答を保存できませんでした。もう一度お試しください。", true);
    }

    // 要約生成を挟まず、最終回答の保存後はそのままアバター同士の会話へ進む。
    const nextPath = row.next_question_order === null
      ? "/matching"
      : `/interview/${row.next_question_order}`;
    return success({
      revision: row.revision,
      answeredCount: row.answered_count,
      nextPath,
    });
  } catch (error) {
    if (error instanceof InterviewAnswerValidationError) {
      return failure("VALIDATION_ERROR", error.message, false);
    }
    if (error instanceof Error && error.name === "ZodError") {
      return failure("VALIDATION_ERROR", "回答内容を確認してください。", false);
    }

    const actionError = toActionError(error);
    if (actionError.code === "INTERNAL_ERROR") {
      const details = error as { name?: string; message?: string } | null;
      logError("interview_answer_save_exception", {
        errorName: details?.name,
        dbErrorId: identifyDbErrorCode(details?.message),
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
