"use server";

import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function startAnonymousJourney(): Promise<ActionResult<{ nextPath: string }>> {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (!claimsError && typeof claimsData?.claims?.sub === "string") {
    return success({ nextPath: "/interview/1" });
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) {
    logError("anonymous_session_failed", { errorCode: error?.name ?? "UNKNOWN" });
    const actionError = toActionError(error);
    return failure(actionError.code, actionError.message, actionError.retryable);
  }

  return success({ nextPath: "/interview/1" });
}
