"use server";

import { requireUser } from "@/features/identity/server/session";
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
    if (error?.message.includes("STALE_PROFILE")) {
      return failure("STATE_CONFLICT", "回答が更新されています。プロフィールを再生成してください。", false);
    }
    if (error) throw error;
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
      const details = error as { name?: string; code?: string } | null;
      logError("match_start_failed", { errorName: details?.name, errorCode: details?.code });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
