import { afterEach, describe, expect, it } from "vitest";

import {
  deriveGateToken,
  isAccessGateEnabled,
  verifyAccessPassphrase,
  verifyGateCookieValue,
} from "@/lib/access-gate/gate";

// テスト専用のダミー値であり、実際に配布している合言葉ではない。
const TEST_ACCESS_CODE = "dummy-test-passphrase-not-real";

afterEach(() => {
  delete process.env.ACCESS_CODE;
});

describe("isAccessGateEnabled", () => {
  it("ACCESS_CODEが未設定ならゲートは無効", () => {
    delete process.env.ACCESS_CODE;
    expect(isAccessGateEnabled()).toBe(false);
  });

  it("ACCESS_CODEが空文字でもゲートは無効", () => {
    process.env.ACCESS_CODE = "";
    expect(isAccessGateEnabled()).toBe(false);
  });

  it("ACCESS_CODEが設定されていればゲートは有効", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(isAccessGateEnabled()).toBe(true);
  });
});

describe("verifyAccessPassphrase", () => {
  it("ACCESS_CODEが未設定なら常に不一致", () => {
    delete process.env.ACCESS_CODE;
    expect(verifyAccessPassphrase(TEST_ACCESS_CODE)).toBe(false);
  });

  it("正しい合言葉を受理する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(verifyAccessPassphrase(TEST_ACCESS_CODE)).toBe(true);
  });

  it("間違った合言葉を拒否する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(verifyAccessPassphrase("wrong-passphrase")).toBe(false);
  });

  it("長さが異なる合言葉でも例外を投げず拒否する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(verifyAccessPassphrase("short")).toBe(false);
    expect(verifyAccessPassphrase(`${TEST_ACCESS_CODE}-and-then-some-more-characters`)).toBe(false);
  });

  it("空文字を拒否する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(verifyAccessPassphrase("")).toBe(false);
  });
});

describe("deriveGateToken / verifyGateCookieValue", () => {
  it("同じ合言葉からは常に同じ導出値になる", () => {
    expect(deriveGateToken(TEST_ACCESS_CODE)).toBe(deriveGateToken(TEST_ACCESS_CODE));
  });

  it("異なる合言葉からは異なる導出値になる", () => {
    expect(deriveGateToken(TEST_ACCESS_CODE)).not.toBe(deriveGateToken("another-passphrase"));
  });

  it("導出値には合言葉そのものが含まれない", () => {
    expect(deriveGateToken(TEST_ACCESS_CODE)).not.toContain(TEST_ACCESS_CODE);
  });

  it("正しい導出値をクッキーに持つ場合は検証を通過する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    const token = deriveGateToken(TEST_ACCESS_CODE);
    expect(verifyGateCookieValue(token)).toBe(true);
  });

  it("改ざんされたクッキー値は拒否する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(verifyGateCookieValue("tampered-value")).toBe(false);
  });

  it("クッキーが無ければ拒否する", () => {
    process.env.ACCESS_CODE = TEST_ACCESS_CODE;
    expect(verifyGateCookieValue(undefined)).toBe(false);
    expect(verifyGateCookieValue(null)).toBe(false);
  });

  it("ACCESS_CODEが未設定なら、正しく見える導出値でも拒否する(ゲート無効時は素通りにしない)", () => {
    const token = deriveGateToken(TEST_ACCESS_CODE);
    delete process.env.ACCESS_CODE;
    expect(verifyGateCookieValue(token)).toBe(false);
  });
});
