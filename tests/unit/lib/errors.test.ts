import { describe, expect, it } from "vitest";
import { UnauthenticatedError, toActionError } from "@/lib/errors";

describe("toActionError", () => {
  it("未認証例外を公開可能な未認証エラーへ変換する", () => {
    expect(toActionError(new UnauthenticatedError())).toEqual({
      code: "UNAUTHENTICATED",
      message: "認証が必要です",
      retryable: false,
    });
  });

  it("未知の例外から内部詳細を返さない", () => {
    expect(toActionError(new Error("database password is secret"))).toEqual({
      code: "INTERNAL_ERROR",
      message: "処理に失敗しました。時間をおいて再試行してください。",
      retryable: true,
    });
  });
});
