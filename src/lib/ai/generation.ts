/**
 * Gemini/OpenAIの両providerで共通の「タイムアウト付き生成 → JSON解析 → 契約検証、
 * 検証に落ちたら1度だけ作り直す」というリトライ手順を一箇所にまとめる。
 * 両providerで別々に実装すると、片方だけ修正されて挙動がずれる事故が起きるため。
 */

/** 生成呼び出しの最小境界。SDKを直接持ち込まずJSON文字列だけを返させる。 */
export type GenerationClient = {
  generateJson(request: { prompt: string; schema: unknown }): Promise<string>;
};

/**
 * AIプロバイダの失敗種別。ログ側(service.ts/process.ts)がerrorのnameとcodeしか見ておらず、
 * throw元(openai-provider.ts等)がメッセージ文字列に詰めた情報が失われていた問題(FR-040)への対応。
 * - http_error: APIがHTTPエラーステータスを返した(status/apiErrorType/apiErrorCodeが埋まる)
 * - timeout: 制限時間内に応答が返らなかった
 * - contract_violation: 応答は返ったがJSON解析や契約検証(Zod/answerRefs等)に失敗した
 * - other: 上記以外(ネットワーク断など)
 */
export type AiFailureKind = "http_error" | "timeout" | "contract_violation" | "other";

/**
 * ログへ残してよい診断情報だけの集合。回答本文・生成された会話本文・APIキー・
 * エラーレスポンス本文そのものは含めない(FR-040の「やってはいけないこと」)。
 */
export type AiDiagnostics = {
  provider: string;
  kind: AiFailureKind;
  httpStatus?: number;
  apiErrorType?: string;
  apiErrorCode?: string;
};

/**
 * AIプロバイダ呼び出しの失敗を、ログ側でも失わずに扱えるよう構造化したエラー。
 * messageは人間が読むための説明文(既存コードとの互換のためINVALID_OUTPUT/TIMEOUT等の
 * プレフィックスを維持する)、diagnosticsは秘密情報を含まない構造化フィールド。
 */
export class AiProviderError extends Error {
  readonly diagnostics: AiDiagnostics;

  constructor(message: string, diagnostics: AiDiagnostics, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiProviderError";
    this.diagnostics = diagnostics;
  }
}

/**
 * 任意のerrorから、ログに残してよい診断情報だけを取り出す。AiProviderErrorでなければ
 * 種別不明("other")として扱う(privacy-provider.ts由来のエラー等、本文が混入し得るものを
 * 誤って構造化フィールドとして残さないための安全側の既定)。
 */
export function extractAiDiagnostics(error: unknown, providerLabel: string): AiDiagnostics {
  if (error instanceof AiProviderError) return error.diagnostics;
  return { provider: providerLabel, kind: "other" };
}

function parseJson(raw: string, providerLabel: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new AiProviderError(
      `INVALID_OUTPUT: ${providerLabel}の応答をJSONとして解釈できませんでした。`,
      { provider: providerLabel, kind: "contract_violation" },
    );
  }
}

async function callWithTimeout(
  client: GenerationClient,
  prompt: string,
  schema: unknown,
  timeoutMs: number,
  providerLabel: string,
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      client.generateJson({ prompt, schema }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new AiProviderError(
            `TIMEOUT: ${providerLabel}の応答が制限時間を超えました。`,
            { provider: providerLabel, kind: "timeout" },
          )),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 生成して契約検証する。検証に落ちた場合だけ1度作り直す。それでも満たさなければ
 * INVALID_OUTPUTとして失敗させ、不正な出力を呼び出し元に返さない。
 */
export async function generateValidated<T>(
  client: GenerationClient,
  prompt: string,
  schema: unknown,
  timeoutMs: number,
  providerLabel: string,
  validate: (value: unknown) => T,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await callWithTimeout(client, prompt, schema, timeoutMs, providerLabel);
    try {
      return validate(parseJson(raw, providerLabel));
    } catch (error) {
      lastError = error;
    }
  }
  throw new AiProviderError(
    `INVALID_OUTPUT: ${providerLabel}の出力が契約を満たしませんでした。`,
    { provider: providerLabel, kind: "contract_violation" },
    { cause: lastError },
  );
}
