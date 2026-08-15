import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { getServerEnv } from "@/lib/env/server";

/**
 * 合言葉ゲート(限定公開)で使うクッキー名。
 * このクッキーには合言葉そのものは入れず、ACCESS_CODEから導出した値(HMAC)だけを入れる。
 */
export const ACCESS_GATE_COOKIE_NAME = "amp_access_gate";

/** クッキーの有効期間(30日)。展示会・デモ期間中はログインし直さなくてよい程度の長さ。 */
export const ACCESS_GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

/** 合言葉入力画面のパス。src/proxy.tsのゲート判定と1箇所で一致させる。 */
export const ACCESS_GATE_PATH = "/access-gate";

// クッキー値の導出に使う文脈文字列。ACCESS_CODEをHMACの鍵として使い、
// この固定文字列をメッセージとして署名することで、ACCESS_CODEを知っているサーバーだけが
// 正しいクッキー値を計算できるようにする(クッキー自体に合言葉を入れないため)。
const TOKEN_CONTEXT = "avatar-matching-access-gate-v1";

/**
 * 長さが異なる文字列同士でも安全に比較できるよう、まずSHA-256で固定長へ正規化してから
 * timingSafeEqualで比較する。
 * (timingSafeEqualはバッファ長が一致しないと例外を投げるため、先に正規化する。
 *  これにより「長さが違う」という情報自体も比較時間の差として漏れない。)
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = createHash("sha256").update(a, "utf8").digest();
  const bufB = createHash("sha256").update(b, "utf8").digest();
  return timingSafeEqual(bufA, bufB);
}

/** ACCESS_CODEから、クッキーへ保存してよい導出値(HMAC-SHA256の16進文字列)を計算する。 */
export function deriveGateToken(accessCode: string): string {
  return createHmac("sha256", accessCode).update(TOKEN_CONTEXT).digest("hex");
}

/**
 * ゲートが有効かどうか。
 * ACCESS_CODEが未設定/空文字ならゲートは無効(=誰でもアクセス可能な状態)になる。
 * ローカル開発・既存E2Eを壊さないための挙動だが、本番で設定を忘れると公開されてしまう点に注意。
 */
export function isAccessGateEnabled(): boolean {
  return Boolean(getServerEnv().ACCESS_CODE);
}

/** 入力された合言葉が正しいかを、タイミング安全に検証する。 */
export function verifyAccessPassphrase(input: string): boolean {
  const { ACCESS_CODE } = getServerEnv();
  if (!ACCESS_CODE) return false;
  return timingSafeStringEqual(input, ACCESS_CODE);
}

/** クッキー値が、現在のACCESS_CODEから導出された正しい値かをタイミング安全に検証する。 */
export function verifyGateCookieValue(value: string | undefined | null): boolean {
  const { ACCESS_CODE } = getServerEnv();
  if (!ACCESS_CODE || !value) return false;
  return timingSafeStringEqual(value, deriveGateToken(ACCESS_CODE));
}
