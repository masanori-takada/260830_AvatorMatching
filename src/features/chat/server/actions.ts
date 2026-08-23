"use server";

import { requireUser } from "@/features/identity/server/session";
import { identifyDbErrorCode } from "@/lib/db-error-codes";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { chatMessageInputSchema, type ChatMessageInput } from "./schemas";

export async function sendChatMessage(input: ChatMessageInput): Promise<ActionResult<{ messageId: string }>> {
  const parsed = chatMessageInputSchema.safeParse(input);
  if (!parsed.success) return failure("VALIDATION_ERROR", "メッセージは1〜1000文字で入力してください。", false);

  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { data, error } = await client.rpc("send_chat_message", {
      p_connection_id: parsed.data.connectionId,
      p_text: parsed.data.text,
    });

    const dbErrorId = identifyDbErrorCode(error?.message);
    if (dbErrorId === "INVALID_MESSAGE") {
      return failure("VALIDATION_ERROR", "メッセージは1〜1000文字で入力してください。", false);
    }
    if (dbErrorId === "CHAT_NOT_CONNECTED") {
      return failure("STATE_CONFLICT", "チャット接続が完了していません。", false);
    }
    if (dbErrorId === "CONNECTION_NOT_FOUND") {
      return failure("NOT_FOUND", "チャット接続が見つかりません。", false);
    }
    if (error) throw error;

    if (typeof data !== "string") throw new Error("INVALID_CHAT_MESSAGE_RESULT");
    return success({ messageId: data });
  } catch (error) {
    const actionError = toActionError(error);
    if (actionError.code === "INTERNAL_ERROR") {
      const details = error as { name?: string; code?: string; message?: string } | null;
      logError("chat_message_send_failed", {
        errorName: details?.name,
        errorCode: details?.code,
        dbErrorId: identifyDbErrorCode(details?.message),
      });
    }
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}

