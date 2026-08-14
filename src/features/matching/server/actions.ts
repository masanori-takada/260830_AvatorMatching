"use server";

import { requireUser } from "@/features/identity/server/session";
import { toActionError } from "@/lib/errors";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type StartMatchRow = { match_run_id: string; status: "queued" };

export async function startMatch(): Promise<ActionResult<{ matchRunId: string; status: "queued" }>> {
  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("start_match_run");
    if (error) throw error;
    const row = (data as StartMatchRow[] | null)?.[0];
    if (!row || row.status !== "queued") {
      return failure("STATE_CONFLICT", "マッチ処理はすでに開始されています。", false);
    }
    return success({ matchRunId: row.match_run_id, status: row.status });
  } catch (error) {
    const actionError = toActionError(error);
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
