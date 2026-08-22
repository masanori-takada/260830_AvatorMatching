import { AiProviderError, generateValidated } from "@/lib/ai/generation";
import { ANSWER_REF_CODES, buildMatchPrompt, buildProfilePrompt } from "@/lib/ai/prompts";
import { assertAnswerRefsAreDisclosed, avatarProfileOutputSchema, matchOutputSchema } from "@/lib/ai/schemas";
import type {
  AiProvider,
  AvatarProfileOutput,
  MatchInput,
  MatchOutput,
  ProfileInput,
} from "@/lib/ai/types";
// 型だけの参照。import typeはビルド時に消えるため、AI_PROVIDER=mockの経路でも実行時にSDKを読み込まない。
import type { Schema } from "@google/genai";

/**
 * 既定モデル。GEMINI_MODEL環境変数で差し替えられる。
 *
 * 実測比較(同一入力、schema厳格化後、当時の発言数8〜12発言時点):
 * - gemini-3.5-flash-lite: 要約1.6〜2.9秒 / 会話4.4〜4.9秒、契約充足4/4、反映6〜8問
 * - gemini-3.6-flash:      要約6.0〜8.1秒 / 会話11.7〜14.1秒、契約充足3/3、反映8〜13問
 *
 * 3.6 Flashの方が回答をより多く会話へ織り込むが、待ち時間が約3倍になる。
 * (発言数を24〜36発言へ拡大した際の再実測はGEMINI_TIMEOUT_MSのコメントを参照。
 * liteのままでも24発言を安定して満たせたため、既定モデルはliteを維持する。)
 * 体験上の待ち時間を優先してliteを既定とする。2.0系は2026-06-01に停止済みのため使わない。
 */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

/**
 * 生成1回あたりの上限。
 *
 * 会話発言数を8〜12発言から24〜36発言(3倍)へ広げたことに伴い実測し直した値。
 * 実測(gemini-3.5-flash-lite、既定モデル、q01〜q42相当の42問を入力):
 * - generateProfile: 2.2〜5.1秒
 * - generateMatch(24発言): 9.2〜10.1秒
 * 発言数の上限(36発言)や実運用でのネットワーク変動を見込み、実測最大値(約10秒)へ
 * 2.5倍程度の余裕を持たせた25秒とする。
 * 契約違反時の作り直しは1度だけなので最悪50秒(25秒×2)になるが、これは
 * Vercelの実行時間上限(maxDuration=60、process route/interview完了route)に収まる。
 * それでも間に合わない場合は画面側の30秒タイムアウト(useMatchRun)が先に失敗表示と
 * 再試行手段を提示する(SC-009)。
 */
export const GEMINI_TIMEOUT_MS = 25_000;

/**
 * Gemini呼び出しの最小境界。
 * SDKを直接持ち込まずJSON文字列だけを返させることで、テストで通信を差し替えられる。
 */
export type GeminiClient = {
  generateJson(request: { prompt: string; schema: unknown }): Promise<string>;
};

type GeminiProviderOptions = {
  client: GeminiClient;
  /** providerIdへ記録するモデル名。clientへ渡したモデルと一致させること。 */
  model?: string;
  timeoutMs?: number;
};

/** Geminiのresponse schemaはOpenAPI 3.0のsubset。Zod側の制約は生成後に再検証する。 */
const profileResponseSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    traits: {
      type: "object",
      properties: {
        leisure: { type: "string" },
        communication: { type: "string" },
        lifestyle: { type: "string" },
        values: { type: "string" },
        relationships: { type: "string" },
        priorities: { type: "string" },
      },
      required: ["leisure", "communication", "lifestyle", "values", "relationships", "priorities"],
    },
  },
  required: ["summary", "traits"],
} as const;

const matchResponseSchema = {
  type: "object",
  properties: {
    messages: {
      // 件数はプロンプトの指示だけでは守られない。schemaで下限・上限を課す。
      // 24〜36発言(旧8〜12発言の3倍)。
      type: "array",
      minItems: 24,
      maxItems: 36,
      items: {
        type: "object",
        properties: {
          turnIndex: { type: "integer" },
          speaker: { type: "string", enum: ["user_avatar", "candidate_avatar"] },
          body: { type: "string" },
          answerRefs: {
            type: "array",
            minItems: 1,
            items: { type: "string", enum: ANSWER_REF_CODES },
          },
        },
        required: ["turnIndex", "speaker", "body", "answerRefs"],
      },
    },
    report: {
      type: "object",
      properties: {
        overallScore: { type: "integer" },
        summary: { type: "string" },
        caution: { type: "string" },
        dimensions: {
          type: "array",
          minItems: 5,
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              axis: {
                type: "string",
                enum: [
                  "conversation_flow",
                  "values_alignment",
                  "humor_fit",
                  "mutual_interest",
                  "mismatch_severity",
                ],
              },
              score: { type: "integer" },
              explanation: { type: "string" },
              evidenceTurnIndex: { type: "integer" },
            },
            required: ["axis", "score", "explanation", "evidenceTurnIndex"],
          },
        },
      },
      required: ["overallScore", "summary", "caution", "dimensions"],
    },
  },
  required: ["messages", "report"],
} as const;

/**
 * Geminiを使うAiProvider。
 * 出力はZod契約で再検証し、満たさない場合は1度だけ作り直す。
 * それでも満たさなければINVALID_OUTPUTとして失敗させ、不正な会話を保存しない。
 */
export class GeminiAiProvider implements AiProvider {
  /** 生成に使ったモデルをmatch_runsのproviderへ残すため、実際のモデル名を含める。 */
  readonly providerId: string;

  private readonly client: GeminiClient;
  private readonly timeoutMs: number;

  constructor({ client, model = GEMINI_MODEL, timeoutMs = GEMINI_TIMEOUT_MS }: GeminiProviderOptions) {
    this.client = client;
    this.timeoutMs = timeoutMs;
    this.providerId = `gemini:${model}`;
  }

  async generateProfile(input: ProfileInput): Promise<AvatarProfileOutput> {
    return generateValidated(
      this.client,
      buildProfilePrompt(input),
      profileResponseSchema,
      this.timeoutMs,
      "Gemini",
      (value) => avatarProfileOutputSchema.parse(value),
    );
  }

  async generateMatch(input: MatchInput): Promise<MatchOutput> {
    // 実際にAIへ渡した回答コードの集合。answerRefsがこれ以外を指していれば契約違反として
    // 扱う(開示同意の無い回答が「会話で触れられたかのように」見えてしまうのを防ぐ)。
    const disclosedAnswerCodes = new Set(input.answers.map(({ questionCode }) => questionCode));
    return generateValidated(
      this.client,
      buildMatchPrompt(input),
      matchResponseSchema,
      this.timeoutMs,
      "Gemini",
      (value) => assertAnswerRefsAreDisclosed(matchOutputSchema.parse(value), disclosedAnswerCodes),
    );
  }
}

type CreateGeminiClientOptions = {
  apiKey: string;
  model?: string;
};

/**
 * `@google/genai`を実際に呼び出すGeminiClient実装を作る。
 * SDKのimportをここに閉じ込め、動的import(遅延読み込み)にすることで、
 * AI_PROVIDER=mockの経路(この関数が一度も呼ばれない経路)ではSDKがロードされないようにする。
 */
export function createGeminiClient({ apiKey, model = GEMINI_MODEL }: CreateGeminiClientOptions): GeminiClient {
  return {
    async generateJson({ prompt, schema }): Promise<string> {
      const { ApiError, GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey });
      let response;
      try {
        response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema as Schema,
          },
        });
      } catch (error) {
        if (error instanceof ApiError) {
          throw new AiProviderError(
            `HTTP_ERROR: Gemini APIがエラーを返しました(status=${error.status})。`,
            { provider: "Gemini", kind: "http_error", httpStatus: error.status, ...extractGeminiErrorDetails(error) },
          );
        }
        throw error;
      }
      const text = response.text;
      if (!text) {
        throw new AiProviderError(
          "INVALID_OUTPUT: Geminiの応答が空でした。",
          { provider: "Gemini", kind: "contract_violation" },
        );
      }
      return text;
    },
  };
}

/**
 * GeminiのApiError.messageは`JSON.stringify({ error: { message, code, status } })`という形
 * (SDKのthrowErrorIfNotOKが組み立てる)。この中の`message`はAPI側が組み立てた文言で
 * 利用者の回答本文を含む保証がないが、丸ごとログへ出すのは避け(禁止事項)、
 * 種別を表す`status`(例: "RESOURCE_EXHAUSTED")とコードを表す`code`だけを取り出す。
 * JSONとして解釈できない場合はどちらもundefinedのまま返す。
 */
function extractGeminiErrorDetails(error: { message: string }): { apiErrorType?: string; apiErrorCode?: string } {
  try {
    const parsed = JSON.parse(error.message) as { error?: { status?: unknown; code?: unknown } };
    const apiErrorType = typeof parsed.error?.status === "string" ? parsed.error.status : undefined;
    const apiErrorCode = typeof parsed.error?.code === "string" || typeof parsed.error?.code === "number"
      ? String(parsed.error.code)
      : undefined;
    return { apiErrorType, apiErrorCode };
  } catch {
    return {};
  }
}
