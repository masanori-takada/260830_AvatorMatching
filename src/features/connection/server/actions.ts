"use server";

import { requireUser } from "@/features/identity/server/session";
import { identifyDbErrorCode } from "@/lib/db-error-codes";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { contactDecisionInputSchema, type ContactDecisionInput } from "./schemas";

export type ConnectionDecisionState = "connected" | "closed";
export type ContactDecisionResult = {
  state: ConnectionDecisionState;
  connectionId: string | null;
};

export async function commitContactDecision(
  input: ContactDecisionInput,
): Promise<ActionResult<ContactDecisionResult>> {
  const parsed = contactDecisionInputSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR", "決定内容を確認してください。", false);

  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("commit_contact_decision", {
      p_connection_id: parsed.data.connectionId,
      p_kind: parsed.data.kind,
    });

    const dbErrorId = identifyDbErrorCode(error?.message);
    if (dbErrorId === "INVALID_CONTACT_DECISION") {
      return failure("VALIDATION_ERROR", "決定内容を確認してください。", false);
    }
    if (dbErrorId === "CONNECTION_NOT_FOUND") {
      return failure("NOT_FOUND", "対象のつながりが見つかりません。", false);
    }
    if (dbErrorId === "CONTACT_STATE_CONFLICT") {
      return failure("STATE_CONFLICT", "このつながりは、現在その操作を受け付けられません。", false);
    }
    const conflictingDecision = error?.message.match(/CONTACT_DECISION_CONFLICT:(accept|decline)/)?.[1];
    if (conflictingDecision) {
      return failure("STATE_CONFLICT", "このつながりの決定はすでに確定しています。", false);
    }
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as {
      state?: unknown;
      connection_id?: unknown;
    } | null;
    if (
      !row ||
      (row.state !== "connected" && row.state !== "closed") ||
      (row.connection_id !== null && typeof row.connection_id !== "string")
    ) {
      throw new Error("INVALID_CONTACT_DECISION_RESULT");
    }
    return success({
      state: row.state,
      connectionId: row.connection_id,
    });
  } catch (error) {
    const actionError = toActionError(error);
    if (actionError.code === "INTERNAL_ERROR") {
      const details = error as { name?: string; code?: string; message?: string } | null;
      logError("contact_decision_failed", {
        errorName: details?.name,
        errorCode: details?.code,
        dbErrorId: identifyDbErrorCode(details?.message),
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
