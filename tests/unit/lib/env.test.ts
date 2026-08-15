import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

describe("parseEnv", () => {
  it("必須の環境変数とmock providerを受理する", () => {
    expect(
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AI_PROVIDER: "mock",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      AI_PROVIDER: "mock",
    });
  });

  it("未対応のAI providerを拒否する", () => {
    expect(() => parseEnv({ AI_PROVIDER: "automatic" })).toThrow("AI_PROVIDER");
  });

  it("AI_PROVIDER=geminiでGEMINI_API_KEYがあれば受理する", () => {
    expect(
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AI_PROVIDER: "gemini",
        // テスト専用のダミー値であり実際のAPIキーではない
        GEMINI_API_KEY: "dummy-test-key-not-real",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "dummy-test-key-not-real",
    });
  });

  it("AI_PROVIDER=geminiなのにGEMINI_API_KEYが無ければ拒否する", () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
        AI_PROVIDER: "gemini",
      }),
    ).toThrow("GEMINI_API_KEY");
  });
});
