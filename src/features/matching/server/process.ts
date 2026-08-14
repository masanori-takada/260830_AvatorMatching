import { ZodError } from "zod";

import { requireUser } from "@/features/identity/server/session";
import { getOwnedMatchInput } from "@/features/matching/server/queries";
import { getAiProvider } from "@/lib/ai/provider";
import { matchOutputSchema } from "@/lib/ai/schemas";
import { logError } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function processOwnedMatch(matchRunId: string): Promise<"completed"> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data: claimedStatus, error: claimError } = await client.rpc("claim_match_run", {
    p_match_run_id: matchRunId,
  });
  if (claimError) throw claimError;
  if (claimedStatus === "completed") return "completed";
  if (claimedStatus !== "processing") throw new Error("STATE_CONFLICT");

  try {
    const input = await getOwnedMatchInput(client, matchRunId, userId);
    const output = matchOutputSchema.parse(await getAiProvider().generateMatch(input));
    const { error: completeError } = await client.rpc("complete_match_run", {
      p_match_run_id: matchRunId,
      p_payload: output,
    });
    if (completeError) throw completeError;
    return "completed";
  } catch (error) {
    const errorCode = error instanceof ZodError ? "INVALID_OUTPUT" : "PROVIDER_ERROR";
    const { error: failError } = await client.rpc("fail_match_run", {
      p_match_run_id: matchRunId,
      p_error_code: errorCode,
    });
    logError("match_processing_failed", {
      matchRunId,
      errorCode,
      errorName: error instanceof Error ? error.name : "UnknownError",
      failErrorCode: failError?.code,
    });
    throw error;
  }
}
