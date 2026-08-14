import { MockAiProvider } from "@/lib/ai/mock-provider";
import { PrivacySafeAiProvider } from "@/lib/ai/privacy-provider";
import type { AiProvider } from "@/lib/ai/types";

export function getAiProvider(name: string | undefined = process.env.AI_PROVIDER): AiProvider {
  if (name === "mock") {
    return new PrivacySafeAiProvider(new MockAiProvider());
  }
  throw new Error("未対応のAI providerです。");
}
