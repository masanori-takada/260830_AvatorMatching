import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/lib/env/public";
import { parseServerEnv } from "@/lib/env/server";

describe("parsePublicEnv", () => {
  it("必須の公開環境変数を受理する", () => {
    expect(
      parsePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
    });
  });

  it("NEXT_PUBLIC_SUPABASE_URLが無ければ拒否する", () => {
    expect(() =>
      parsePublicEnv({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key" }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });
});

describe("parseServerEnv", () => {
  it("mock providerを受理する", () => {
    expect(parseServerEnv({ AI_PROVIDER: "mock" })).toEqual({ AI_PROVIDER: "mock" });
  });

  it("未対応のAI providerを拒否する", () => {
    expect(() => parseServerEnv({ AI_PROVIDER: "automatic" })).toThrow("AI_PROVIDER");
  });

  it("AI_PROVIDER=geminiでGEMINI_API_KEYがあれば受理する", () => {
    expect(
      parseServerEnv({
        AI_PROVIDER: "gemini",
        // テスト専用のダミー値であり実際のAPIキーではない
        GEMINI_API_KEY: "dummy-test-key-not-real",
      }),
    ).toEqual({
      AI_PROVIDER: "gemini",
      GEMINI_API_KEY: "dummy-test-key-not-real",
    });
  });

  it("AI_PROVIDER=geminiなのにGEMINI_API_KEYが無ければ拒否する", () => {
    expect(() => parseServerEnv({ AI_PROVIDER: "gemini" })).toThrow("GEMINI_API_KEY");
  });
});
