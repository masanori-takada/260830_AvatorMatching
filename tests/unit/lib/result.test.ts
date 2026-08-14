import { describe, expect, it } from "vitest";
import { failure, success } from "@/lib/result";

describe("ActionResult", () => {
  it("成功時は呼び出し元が利用できるデータを返す", () => {
    expect(success({ nextPath: "/interview/1" })).toEqual({
      ok: true,
      data: { nextPath: "/interview/1" },
    });
  });

  it("失敗時は再試行可否を含む公開可能なエラーだけを返す", () => {
    expect(failure("UNAUTHENTICATED", "認証が必要です", false)).toEqual({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "認証が必要です",
        retryable: false,
      },
    });
  });
});
