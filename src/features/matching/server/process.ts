import { ZodError } from "zod";

import { requireUser } from "@/features/identity/server/session";
import { getOwnedMatchInput } from "@/features/matching/server/queries";
import { extractAiDiagnostics } from "@/lib/ai/generation";
import { getAiProvider } from "@/lib/ai/provider";
import { matchOutputSchema } from "@/lib/ai/schemas";
import { identifyDbErrorCode, UNKNOWN_DB_ERROR_CODE } from "@/lib/db-error-codes";
import { logError } from "@/lib/logger";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

function readStringProperty(value: unknown, key: "code" | "message"): string | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const property = Reflect.get(value, key);
  return typeof property === "string" ? property : undefined;
}

function identifySqlState(code: string | undefined): string | undefined {
  return code && SQLSTATE_PATTERN.test(code) ? code : undefined;
}

function extractSafeDbDiagnostics(error: unknown) {
  const message = error instanceof Error ? error.message : readStringProperty(error, "message");
  const rawCode = readStringProperty(error, "code");
  const messageErrorId = identifyDbErrorCode(message);
  const codeErrorId = identifyDbErrorCode(rawCode);
  const dbErrorId = messageErrorId !== UNKNOWN_DB_ERROR_CODE ? messageErrorId : codeErrorId;
  let errorName = "UnknownError";
  if (error instanceof Error) errorName = error.name;
  else if (message || rawCode) errorName = "SupabaseError";

  return {
    dbErrorId,
    dbErrorCode: identifySqlState(rawCode),
    errorName,
  };
}

export async function processOwnedMatch(matchRunId: string): Promise<"completed"> {
  const { userId } = await requireUser();
  const client = await createServerSupabaseClient();
  const { data: claimedStatus, error: claimError } = await client.rpc("claim_match_run", {
    p_match_run_id: matchRunId,
  });
  if (claimError) {
    // claim_match_run()の識別子(MATCH_NOT_FOUND/STATE_CONFLICT/RETRY_LIMIT等)だけを残す(FR-040)。
    logError("match_claim_failed", { matchRunId, dbErrorId: identifyDbErrorCode(claimError.message) });
    throw claimError;
  }
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
    const { dbErrorId, dbErrorCode, errorName } = extractSafeDbDiagnostics(error);
    const isInvalidOutput = error instanceof ZodError || dbErrorId === "INVALID_OUTPUT";
    const errorCode = isInvalidOutput ? "INVALID_OUTPUT" : "PROVIDER_ERROR";
    const { error: failError } = await client.rpc("fail_match_run", {
      p_match_run_id: matchRunId,
      p_error_code: errorCode,
    });
    // AiProviderError(openai-provider.ts/gemini-provider.ts/generation.ts)なら、
    // provider種別・失敗種別・HTTPステータス・APIのエラー種別/コードを構造化して残す(FR-040)。
    // 回答本文・生成された会話本文・APIキーは含まない。dbErrorIdはcomplete_match_run()が
    // 投げた識別子(STATE_CONFLICT/RETRY_LIMIT/INVALID_OUTPUT等)と完全一致した場合だけの値。
    logError("match_processing_failed", {
      matchRunId,
      errorCode,
      errorName,
      dbErrorId,
      dbErrorCode,
      failErrorCode: identifySqlState(readStringProperty(failError, "code")),
      ...extractAiDiagnostics(error, "unknown"),
    });
    if (isInvalidOutput) throw new Error("INVALID_OUTPUT", { cause: error });
    throw error;
  }
}
