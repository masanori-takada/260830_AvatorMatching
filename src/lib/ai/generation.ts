/**
 * Gemini/OpenAIの両providerで共通の「タイムアウト付き生成 → JSON解析 → 契約検証、
 * 検証に落ちたら1度だけ作り直す」というリトライ手順を一箇所にまとめる。
 * 両providerで別々に実装すると、片方だけ修正されて挙動がずれる事故が起きるため。
 */

/** 生成呼び出しの最小境界。SDKを直接持ち込まずJSON文字列だけを返させる。 */
export type GenerationClient = {
  generateJson(request: { prompt: string; schema: unknown }): Promise<string>;
};

function parseJson(raw: string, providerLabel: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`INVALID_OUTPUT: ${providerLabel}の応答をJSONとして解釈できませんでした。`);
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
          () => reject(new Error(`TIMEOUT: ${providerLabel}の応答が制限時間を超えました。`)),
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
  throw new Error(`INVALID_OUTPUT: ${providerLabel}の出力が契約を満たしませんでした。`, { cause: lastError });
}
