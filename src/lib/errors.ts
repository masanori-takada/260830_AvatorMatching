import type { ActionError } from "@/lib/result";

export class UnauthenticatedError extends Error {
  constructor() {
    super("認証が必要です");
    this.name = "UnauthenticatedError";
  }
}

export function toActionError(error: unknown): ActionError {
  if (error instanceof UnauthenticatedError) {
    return {
      code: "UNAUTHENTICATED",
      message: "認証が必要です",
      retryable: false,
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "処理に失敗しました。時間をおいて再試行してください。",
    retryable: true,
  };
}
