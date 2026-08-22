"use server";

import { requireUser } from "@/features/identity/server/session";
import { identifyDbErrorCode } from "@/lib/db-error-codes";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionError } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { decisionInputSchema, type DecisionInput } from "./schemas";

type DecisionOutput = { kind: "accept" | "decline"; nextPath: "/reveal" | "/declined" };
type DecisionConflictDetails = { storedDecision: "accept" | "decline"; nextPath: "/reveal" | "/declined" };
export type CommitDecisionResult =
  | { ok: true; data: DecisionOutput }
  | { ok: false; error: ActionError & { details?: DecisionConflictDetails } };

export async function commitDecision(input: DecisionInput): Promise<CommitDecisionResult> {
  const parsed = decisionInputSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR", "決定内容を確認してください。", false);

  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("commit_decision", {
      p_match_run_id: parsed.data.matchRunId,
      p_kind: parsed.data.kind,
    });
    const storedDecision = error?.message.match(/DECISION_CONFLICT:(accept|decline)/)?.[1] as "accept" | "decline" | undefined;
    if (storedDecision) {
      const nextPath = storedDecision === "accept" ? "/reveal" : "/declined";
      return {
        ok: false,
        error: {
          code: "STATE_CONFLICT",
          message: `すでに${storedDecision === "accept" ? "承諾" : "辞退"}が確定しています。`,
          retryable: false,
          details: { storedDecision, nextPath },
        },
      };
    }
    // commit_decision()が投げる識別子と完全一致した場合だけ分岐する(FR-040)。
    const dbErrorId = identifyDbErrorCode(error?.message);
    if (dbErrorId === "ACCEPT_ALREADY_DECIDED") {
      return failure("STATE_CONFLICT", "すでに他の候補を承諾しています。承諾できるのはお一人だけです。", false);
    }
    if (dbErrorId === "MATCH_NOT_FOUND") {
      return failure("NOT_FOUND", "対象のマッチが見つかりません。", false);
    }
    if (dbErrorId === "STATE_CONFLICT") {
      return failure("STATE_CONFLICT", "会話の完了後に決定できます。", false);
    }
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { kind?: unknown } | null;
    if (!row || (row.kind !== "accept" && row.kind !== "decline")) throw new Error("INVALID_DECISION_RESULT");
    return success({ kind: row.kind, nextPath: row.kind === "accept" ? "/reveal" : "/declined" });
  } catch (error) {
    const actionError = toActionError(error);
    if (actionError.code === "INTERNAL_ERROR") {
      // 原因不明のまま調査が止まるのを避けるため、識別子だけ残す(FR-040)。DBのメッセージ
      // 全文は残さない。
      const details = error as { name?: string; code?: string; message?: string } | null;
      logError("decision_commit_failed", {
        errorName: details?.name,
        errorCode: details?.code,
        dbErrorId: identifyDbErrorCode(details?.message),
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
