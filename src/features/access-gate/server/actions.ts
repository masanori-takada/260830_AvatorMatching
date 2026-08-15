"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ACCESS_GATE_COOKIE_MAX_AGE,
  ACCESS_GATE_COOKIE_NAME,
  deriveGateToken,
  verifyAccessPassphrase,
} from "@/lib/access-gate/gate";
import { getServerEnv } from "@/lib/env/server";

/**
 * "/"始まりの相対パスだけを遷移先として許可する(オープンリダイレクト対策)。
 * "//evil.example.com"のようなプロトコル相対URLも弾く。
 */
function sanitizeNextPath(next: FormDataEntryValue | null): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }
  return next;
}

/**
 * 合言葉入力画面のフォーム送信を処理する。
 *
 * 正しければ、ACCESS_CODEから導出したクッキー(合言葉そのものは入れない)を発行して
 * 元々開こうとしていた画面へ進める。間違っていれば、エラーを付けて入力画面へ戻す。
 * 合言葉の値・クッキー値はどちらもログへ出さない(FR-040の趣旨)。
 */
export async function submitAccessCode(formData: FormData): Promise<void> {
  const code = formData.get("code");
  const next = sanitizeNextPath(formData.get("next"));

  if (typeof code !== "string" || !verifyAccessPassphrase(code)) {
    redirect(`/access-gate?next=${encodeURIComponent(next)}&error=1`);
  }

  const { ACCESS_CODE } = getServerEnv();
  // verifyAccessPassphraseがtrueを返した時点でACCESS_CODEは必ず設定済み。
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_GATE_COOKIE_NAME, deriveGateToken(ACCESS_CODE!), {
    httpOnly: true,
    maxAge: ACCESS_GATE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(next);
}
