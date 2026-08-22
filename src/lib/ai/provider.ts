import { createGeminiClient, GeminiAiProvider } from "@/lib/ai/gemini-provider";
import { MockAiProvider } from "@/lib/ai/mock-provider";
import { createOpenAiClient, OpenAiAiProvider } from "@/lib/ai/openai-provider";
import { PrivacySafeAiProvider } from "@/lib/ai/privacy-provider";
import type { AiProvider } from "@/lib/ai/types";
import { getServerEnv } from "@/lib/env/server";

export function getAiProvider(name: string | undefined = getServerEnv().AI_PROVIDER): AiProvider {
  if (name === "mock") {
    return new PrivacySafeAiProvider(new MockAiProvider());
  }
  if (name === "gemini") {
    const apiKey = getServerEnv().GEMINI_API_KEY;
    if (!apiKey) {
      // 本番で暗黙にモックへフォールバックしない(計画書のGlobal Constraints)。ここで必ず失敗させる。
      throw new Error(
        "GEMINI_API_KEY未設定のため、AI_PROVIDER=geminiで起動できません。モックへは自動フォールバックしません。",
      );
    }
    // モデルはGEMINI_MODELで差し替えられる。未設定なら実測で選んだ既定を使う。
    const model = process.env.GEMINI_MODEL?.trim() || undefined;
    return new PrivacySafeAiProvider(
      new GeminiAiProvider({ client: createGeminiClient({ apiKey, model }), model }),
    );
  }
  if (name === "openai") {
    const apiKey = getServerEnv().OPENAI_API_KEY;
    if (!apiKey) {
      // Geminiと同じ設計判断: 本番で暗黙にモックへフォールバックしない。ここで必ず失敗させる。
      throw new Error(
        "OPENAI_API_KEY未設定のため、AI_PROVIDER=openaiで起動できません。モックへは自動フォールバックしません。",
      );
    }
    // モデルIDはハードコードせずOPENAI_MODELで必ず指定させる(利用者が未確定のモデルIDを
    // こちらで推測しないための意図的な設計)。未設定なら分かりやすいメッセージで失敗させる。
    const model = process.env.OPENAI_MODEL?.trim();
    if (!model) {
      throw new Error(
        "OPENAI_MODEL未設定のため、AI_PROVIDER=openaiで起動できません。モデルIDは推測せず、必ずOPENAI_MODEL環境変数で指定してください。",
      );
    }
    return new PrivacySafeAiProvider(
      new OpenAiAiProvider({ client: createOpenAiClient({ apiKey, model }), model }),
    );
  }
  throw new Error("未対応のAI providerです。");
}
