import { createGeminiClient, GeminiAiProvider } from "@/lib/ai/gemini-provider";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import { PrivacySafeAiProvider } from "@/lib/ai/privacy-provider";
import type { AiProvider } from "@/lib/ai/types";

export function getAiProvider(name: string | undefined = process.env.AI_PROVIDER): AiProvider {
  if (name === "mock") {
    return new PrivacySafeAiProvider(new MockAiProvider());
  }
  if (name === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // 本番で暗黙にモックへフォールバックしない(計画書のGlobal Constraints)。ここで必ず失敗させる。
      throw new Error(
        "GEMINI_API_KEY未設定のため、AI_PROVIDER=geminiで起動できません。モックへは自動フォールバックしません。",
      );
    }
    return new PrivacySafeAiProvider(new GeminiAiProvider({ client: createGeminiClient({ apiKey }) }));
  }
  throw new Error("未対応のAI providerです。");
}
