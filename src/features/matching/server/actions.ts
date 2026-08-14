"use server";

import { requireUser } from "@/features/identity/server/session";
import { toActionError } from "@/lib/errors";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MatchStatus = "queued" | "processing" | "completed" | "failed";
type StartMatchRow = { match_run_id: string; status: MatchStatus };

export async function startMatch(): Promise<ActionResult<{ matchRunId: string; status: MatchStatus }>> {
  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("start_match_run");
    if (error?.message.includes("STALE_PROFILE")) {
      return failure("STATE_CONFLICT", "回答が更新されています。プロフィールを再生成してください。", false);
    }
    if (error) throw error;
    const row = (data as StartMatchRow[] | null)?.[0];
    if (!row || !["queued", "processing", "completed", "failed"].includes(row.status)) {
      return failure("STATE_CONFLICT", "マッチ処理はすでに開始されています。", false);
    }
    return success({ matchRunId: row.match_run_id, status: row.status });
  } catch (error) {
    const actionError = toActionError(error);
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
