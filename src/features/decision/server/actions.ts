"use server";

import { requireUser } from "@/features/identity/server/session";
import { toActionError } from "@/lib/errors";
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
    if (error?.message.includes("MATCH_NOT_FOUND")) {
      return failure("NOT_FOUND", "対象のマッチが見つかりません。", false);
    }
    if (error?.message.includes("STATE_CONFLICT")) {
      return failure("STATE_CONFLICT", "会話の完了後に決定できます。", false);
    }
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { kind?: unknown } | null;
    if (!row || (row.kind !== "accept" && row.kind !== "decline")) throw new Error("INVALID_DECISION_RESULT");
    return success({ kind: row.kind, nextPath: row.kind === "accept" ? "/reveal" : "/declined" });
  } catch (error) {
    const actionError = toActionError(error);
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
