"use server";

import { requireUser } from "@/features/identity/server/session";
import { identifyDbErrorCode } from "@/lib/db-error-codes";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MatchStatus = "queued" | "processing" | "completed" | "failed";
type StartMatchRow = { match_run_id: string; status: MatchStatus };
export type MatchRunSummary = { matchRunId: string; status: MatchStatus };

// start_match_run()は候補者ごとに最大3件のrunを返す(3人の候補と勝手に会話が
// 始まる体験のため)。呼び出し側(matching/page.tsx)はこの配列をそのまま
// MatchingProgressへ渡し、進行状況をまとめて表示する。
export async function startMatch(): Promise<ActionResult<{ matches: MatchRunSummary[] }>> {
  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("start_match_run");
    if (error) {
      // start_match_run()が投げる識別子(SQL側: supabase/migrations/202608220004_gender_matching.sql)
      // のうち、利用者へ次の行動を案内できるものだけ個別に文言化する。それ以外は下のcatchで
      // 識別子だけをログへ残し(FR-040)、汎用エラーとして返す。
      const dbErrorId = identifyDbErrorCode(error.message);
      if (dbErrorId === "INTERVIEW_INCOMPLETE") {
        return failure("STATE_CONFLICT", "インタビューが完了していません。残りの質問に回答してください。", false);
      }
      if (dbErrorId === "CANDIDATE_NOT_FOUND") {
        return failure("NOT_FOUND", "条件に合う候補が見つかりませんでした。時間をおいて再度お試しください。", false);
      }
      throw error;
    }
    const rows = (data as StartMatchRow[] | null) ?? [];
    const validStatuses = new Set(["queued", "processing", "completed", "failed"]);
    if (rows.length === 0 || rows.some((row) => !validStatuses.has(row.status))) {
      return failure("STATE_CONFLICT", "マッチ処理はすでに開始されています。", false);
    }
    return success({ matches: rows.map((row) => ({ matchRunId: row.match_run_id, status: row.status })) });
  } catch (error) {
    const actionError = toActionError(error);
    if (actionError.code === "INTERNAL_ERROR") {
      // 原因不明のまま利用者が詰まるのを避けるため、回答本文を含まない識別子だけ残す(FR-040)。
      // dbErrorIdはDB_ERROR_CODESと完全一致した場合だけの値で、DBのメッセージ全文は残さない。
      const details = error as { name?: string; code?: string; message?: string } | null;
      logError("match_start_failed", {
        errorName: details?.name,
        errorCode: details?.code,
        dbErrorId: identifyDbErrorCode(details?.message),
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
