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
});
