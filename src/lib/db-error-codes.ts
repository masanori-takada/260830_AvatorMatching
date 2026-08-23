// supabase/migrations/ 配下のPL/pgSQL関数が `raise exception '<識別子>'` として
// 実際に投げている識別子の一覧。DBのエラーメッセージ全文はどんな内容を含むか保証できない
// ため(FR-040)、ログや利用者向け分岐へ出してよいのはこの一覧と完全一致した場合だけとする。
// 一致しなければ「不明」として扱う。
//
// この配列とSQL側の食い違いは tests/unit/config/db-error-codes-contract.test.ts が
// 静的に検出する(migrations配下を grep して比較する)。識別子を追加/削除したときは
// 同時にそのテストの期待値も更新すること。
export const DB_ERROR_CODES = [
  "UNAUTHENTICATED",
  "INTERVIEW_LOCKED",
  "VALIDATION_ERROR",
  "OUT_OF_ORDER",
  "STATE_CONFLICT",
  "NOTIFICATION_NOT_FOUND",
  "INTERVIEW_INCOMPLETE",
  "PROFILE_NOT_FOUND",
  "STALE_PROFILE",
  "CANDIDATE_NOT_FOUND",
  "MATCH_NOT_FOUND",
  "RETRY_LIMIT",
  "INVALID_OUTPUT",
  "INVALID_ERROR_CODE",
  "ACCEPT_ALREADY_DECIDED",
  "ACTIVE_CONNECTION_EXISTS",
  "CONNECTION_NOT_FOUND",
  "INVALID_CONTACT_DECISION",
  "CONTACT_STATE_CONFLICT",
  "INVALID_MESSAGE",
  "CHAT_NOT_CONNECTED",
] as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

export const UNKNOWN_DB_ERROR_CODE = "不明" as const;

/**
 * DBのエラーメッセージから、あらかじめ決めた識別子一覧(DB_ERROR_CODES)と
 * 完全一致するものだけを取り出す。メッセージ本文そのものは絶対に返さない
 * (含まれる内容を保証できないため、FR-040)。一致しなければ「不明」を返す。
 */
export function identifyDbErrorCode(
  message: string | null | undefined,
): DbErrorCode | typeof UNKNOWN_DB_ERROR_CODE {
  if (!message) return UNKNOWN_DB_ERROR_CODE;
  // 共通語を含む複合識別子(CONTACT_STATE_CONFLICTなど)を先に判定する。
  const matched = [...DB_ERROR_CODES]
    .sort((left, right) => right.length - left.length)
    .find((code) => message.includes(code));
  return matched ?? UNKNOWN_DB_ERROR_CODE;
}
