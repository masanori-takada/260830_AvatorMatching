import { describe, expect, it, vi } from "vitest";

import { AiProviderError, extractAiDiagnostics, generateValidated, type GenerationClient } from "@/lib/ai/generation";
import { logError } from "@/lib/logger";

// 本番でAI_PROVIDER=openaiに切り替えた際、Vercelのログにerrorのnameとcodeしか残らず
// 「OpenAIが何を返したのか分からない」問題(FR-040)への対応。
// AiProviderErrorがproviderId・失敗種別・HTTPステータス・APIのエラー種別/コードを
// 保持し、それらだけをログへ残せることを確認する。

describe("AiProviderError / extractAiDiagnostics", () => {
  it("AiProviderErrorの診断情報をそのまま取り出す", () => {
    const error = new AiProviderError(
      "HTTP_ERROR: OpenAI APIがエラーを返しました(status=429)。",
      { provider: "OpenAI", kind: "http_error", httpStatus: 429, apiErrorType: "insufficient_quota", apiErrorCode: "rate_limit_exceeded" },
    );

    expect(extractAiDiagnostics(error, "unknown")).toEqual({
      provider: "OpenAI",
      kind: "http_error",
      httpStatus: 429,
      apiErrorType: "insufficient_quota",
      apiErrorCode: "rate_limit_exceeded",
    });
  });

  it("AiProviderError以外(通常のError等)は種別不明(other)として安全側に倒す", () => {
    expect(extractAiDiagnostics(new Error("何か別のエラー"), "unknown")).toEqual({
      provider: "unknown",
      kind: "other",
    });
    expect(extractAiDiagnostics("文字列がthrowされた場合", "unknown")).toEqual({
      provider: "unknown",
      kind: "other",
    });
  });

  it("ログへ診断情報を渡しても、APIキーや回答本文はログへ出ない", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const secretApiKey = "sk-super-secret-api-key-not-real";
    const rawAnswerBody = "散歩でゆっくり過ごしますという利用者の回答本文";

    // 実運用では openai-provider.ts / gemini-provider.ts がHTTPエラー時に
    // AiProviderErrorを投げ、service.ts/process.ts がdiagnosticsだけをlogErrorへ渡す。
    // diagnosticsの型自体がAPIキー・回答本文を保持しないことに加え、
    // logger.ts側のフィールド名フィルタも二重の安全策として機能することを確認する。
    const error = new AiProviderError(
      `HTTP_ERROR: OpenAI APIがエラーを返しました。APIキー=${secretApiKey} 回答=${rawAnswerBody}`,
      { provider: "OpenAI", kind: "http_error", httpStatus: 500, apiErrorType: "server_error" },
    );

    logError("match_processing_failed", {
      matchRunId: "11111111-1111-4111-8111-111111111111",
      errorName: error.name,
      ...extractAiDiagnostics(error, "unknown"),
    });

    const loggedText = spy.mock.calls[0]?.[0] as string;
    expect(loggedText).not.toContain(secretApiKey);
    expect(loggedText).not.toContain(rawAnswerBody);
    const entry = JSON.parse(loggedText) as Record<string, unknown>;
    expect(entry).toEqual({
      level: "error",
      event: "match_processing_failed",
      matchRunId: "11111111-1111-4111-8111-111111111111",
      errorName: "AiProviderError",
      provider: "OpenAI",
      kind: "http_error",
      httpStatus: 500,
      apiErrorType: "server_error",
    });

    spy.mockRestore();
  });
});

describe("generateValidated: 失敗種別の分類", () => {
  it("タイムアウト時はkind=timeoutのAiProviderErrorを投げる", async () => {
    const client: GenerationClient = { generateJson: () => new Promise(() => {}) };

    let caught: unknown;
    try {
      await generateValidated(client, "prompt", {}, 10, "OpenAI", (value) => value);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AiProviderError);
    expect((caught as AiProviderError).diagnostics).toEqual({ provider: "OpenAI", kind: "timeout" });
  });

  it("契約検証に2回とも失敗するとkind=contract_violationのAiProviderErrorを投げる", async () => {
    const client: GenerationClient = { generateJson: vi.fn().mockResolvedValue(JSON.stringify({ foo: "bar" })) };

    let caught: unknown;
    try {
      await generateValidated(client, "prompt", {}, 1_000, "OpenAI", () => {
        throw new Error("契約違反");
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AiProviderError);
    expect((caught as AiProviderError).diagnostics).toEqual({ provider: "OpenAI", kind: "contract_violation" });
  });

  it("JSONとして解釈できない応答もkind=contract_violationとして分類される", async () => {
    const client: GenerationClient = { generateJson: vi.fn().mockResolvedValue("これはJSONではない") };

    let caught: unknown;
    try {
      await generateValidated(client, "prompt", {}, 1_000, "Gemini", (value) => value);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AiProviderError);
    expect((caught as AiProviderError).diagnostics).toEqual({ provider: "Gemini", kind: "contract_violation" });
  });
});
