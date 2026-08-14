export type ActionErrorCode =
  | "UNAUTHENTICATED"
  | "VALIDATION_ERROR"
  | "STATE_CONFLICT"
  | "NOT_FOUND"
  | "RETRY_LIMIT"
  | "INTERNAL_ERROR";

export type ActionError = {
  code: ActionErrorCode;
  message: string;
  retryable: boolean;
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure<T>(
  code: ActionErrorCode,
  message: string,
  retryable: boolean,
): ActionResult<T> {
  return { ok: false, error: { code, message, retryable } };
}
