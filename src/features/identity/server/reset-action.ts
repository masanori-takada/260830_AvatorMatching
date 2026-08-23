"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/features/identity/server/session";
import { identifyDbErrorCode } from "@/lib/db-error-codes";
import { toActionError } from "@/lib/errors";
import { logError } from "@/lib/logger";
import { failure, success, type ActionResult } from "@/lib/result";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * 現在の匿名利用者に属するデモデータ(回答・アバター要約・会話ログ・相性レポート・
 * 決定・つながり・チャット・通知)だけを削除し、未開始状態へ戻す(FR-035)。共有の候補データは影響を受けない。
 * 削除はDB側のRPC(reset_my_demo_data)が単一トランザクションで完結させるため、
 * 途中失敗による削除済み/未削除の混在状態は起きない。
 */
export async function resetDemoData(): Promise<ActionResult<{ nextPath: "/start" }>> {
  try {
    await requireUser();
    const client = await createServerSupabaseClient();
    const { error } = await client.rpc("reset_my_demo_data");
    if (error) throw error;

    // ホーム・マイページ・お知らせなど、直前の状態をキャッシュしている可能性がある
    // 画面すべてを再検証し、リセット後に古い表示が残らないようにする。
    revalidatePath("/", "layout");

    return success({ nextPath: "/start" });
  } catch (error) {
    const actionError = toActionError(error);
    // 回答本文や秘密情報は含めず、原因追跡に必要な識別子だけを記録する(FR-040)。
    const details = error as { name?: string; code?: string; message?: string } | null;
    logError("reset_failed", {
      errorName: details?.name,
      errorCode: details?.code,
      dbErrorId: identifyDbErrorCode(details?.message),
    });
    return failure(actionError.code, actionError.message, actionError.retryable);
  }
}
