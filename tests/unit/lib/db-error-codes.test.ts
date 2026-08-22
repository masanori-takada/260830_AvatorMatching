import { describe, expect, it } from "vitest";

import { DB_ERROR_CODES, identifyDbErrorCode, UNKNOWN_DB_ERROR_CODE } from "@/lib/db-error-codes";

describe("identifyDbErrorCode", () => {
  it.each(DB_ERROR_CODES)("既知の識別子 %s を含むメッセージはその識別子として返す", (code) => {
    expect(identifyDbErrorCode(code)).toBe(code);
    // PostgREST/pg実装はraise exceptionのメッセージをそのまま渡してくるため、
    // 前後に付加情報が付くケースも一致させられる必要がある。
    expect(identifyDbErrorCode(`ERROR:  ${code}`)).toBe(code);
  });

  it("既知の識別子と一致しないメッセージは「不明」を返す(内容そのものは返さない)", () => {
    const secret = "回答本文が漏れていたら困るテキスト sensitive-answer-body-12345";
    expect(identifyDbErrorCode(secret)).toBe(UNKNOWN_DB_ERROR_CODE);
    // メッセージ本文がそのまま返っていないことを明示的に確認する(FR-040)。
    expect(identifyDbErrorCode(secret)).not.toContain("sensitive-answer-body");
  });

  it("null/undefined/空文字は「不明」を返す", () => {
    expect(identifyDbErrorCode(null)).toBe(UNKNOWN_DB_ERROR_CODE);
    expect(identifyDbErrorCode(undefined)).toBe(UNKNOWN_DB_ERROR_CODE);
    expect(identifyDbErrorCode("")).toBe(UNKNOWN_DB_ERROR_CODE);
  });
});
