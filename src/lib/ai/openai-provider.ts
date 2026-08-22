import { generateValidated } from "@/lib/ai/generation";
import { ANSWER_REF_CODES, buildMatchPrompt, buildProfilePrompt } from "@/lib/ai/prompts";
import { assertAnswerRefsAreDisclosed, avatarProfileOutputSchema, matchOutputSchema } from "@/lib/ai/schemas";
import type {
  AiProvider,
  AvatarProfileOutput,
  MatchInput,
  MatchOutput,
  ProfileInput,
} from "@/lib/ai/types";

/**
 * 生成1回あたりの上限。GeminiAiProvider(gemini-provider.ts)の実測(24〜36発言化後、
 * generateMatch 9.2〜10.1秒)にもとづく値をそのまま踏襲する。OpenAIのモデルは
 * OPENAI_MODEL環境変数側で未確定のため、Geminiと別に実測してこの値を調整することはせず、
 * 同一の安全側の値(実測最大値の2.5倍程度)を暫定的に共有する。
 * 契約違反時の作り直しは1度だけなので最悪50秒(25秒×2)になるが、これはVercelの
 * 実行時間上限(maxDuration=60)に収まる。
 */
export const OPENAI_TIMEOUT_MS = 25_000;

/**
 * OpenAI呼び出しの最小境界。
 * SDKを直接持ち込まずJSON文字列だけを返させることで、テストで通信を差し替えられる。
 */
export type OpenAiClient = {
  generateJson(request: { prompt: string; schema: unknown }): Promise<string>;
};

type OpenAiProviderOptions = {
  client: OpenAiClient;
  /** providerIdへ記録するモデル名。clientへ渡したモデルと一致させること。 */
  model: string;
  timeoutMs?: number;
};

/**
 * OpenAIのstructured outputs(strict mode)向けJSON Schema。
 * strict modeでは各オブジェクトに`additionalProperties: false`が必須で、
 * `required`は`properties`の全キーを含める必要がある(Geminiのような任意項目は使えない)。
 * minItems/maxItemsはstrict modeでサポートされないため付けず、件数の担保は
 * プロンプトの指示とZod契約の再検証(満たさない場合の1回リトライ)に委ねる。
 */
const profileResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    traits: {
      type: "object",
      additionalProperties: false,
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
  additionalProperties: false,
  properties: {
    messages: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          turnIndex: { type: "integer" },
          speaker: { type: "string", enum: ["user_avatar", "candidate_avatar"] },
          body: { type: "string" },
          answerRefs: {
            type: "array",
            items: { type: "string", enum: ANSWER_REF_CODES },
          },
        },
        required: ["turnIndex", "speaker", "body", "answerRefs"],
      },
    },
    report: {
      type: "object",
      additionalProperties: false,
      properties: {
        overallScore: { type: "integer" },
        summary: { type: "string" },
        caution: { type: "string" },
        dimensions: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
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
 * OpenAIを使うAiProvider。GeminiAiProviderと同じ構造(クライアント注入・タイムアウト・
 * Zod契約での再検証・1回だけの作り直し)を踏襲する。
 * 出力はZod契約で再検証し、満たさない場合は1度だけ作り直す。
 * それでも満たさなければINVALID_OUTPUTとして失敗させ、不正な会話を保存しない。
 */
export class OpenAiAiProvider implements AiProvider {
  /** 生成に使ったモデルをmatch_runsのproviderへ残すため、実際のモデル名を含める。 */
  readonly providerId: string;

  private readonly client: OpenAiClient;
  private readonly timeoutMs: number;

  constructor({ client, model, timeoutMs = OPENAI_TIMEOUT_MS }: OpenAiProviderOptions) {
    this.client = client;
    this.timeoutMs = timeoutMs;
    this.providerId = `openai:${model}`;
  }

  async generateProfile(input: ProfileInput): Promise<AvatarProfileOutput> {
    return generateValidated(
      this.client,
      buildProfilePrompt(input),
      profileResponseSchema,
      this.timeoutMs,
      "OpenAI",
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
      "OpenAI",
      (value) => assertAnswerRefsAreDisclosed(matchOutputSchema.parse(value), disclosedAnswerCodes),
    );
  }
}

type CreateOpenAiClientOptions = {
  apiKey: string;
  model: string;
};

/**
 * OpenAIのChat Completions API(structured outputs)を実際に呼び出すOpenAiClient実装を作る。
 * `openai`パッケージへの依存を追加せず、fetchで直接呼び出す(Geminiが`@google/genai`のSDK
 * importを動的import化してAI_PROVIDER=mockの経路から隔離しているのと同じ意図で、
 * ここではそもそも外部SDKを持ち込まない)。
 */
export function createOpenAiClient({ apiKey, model }: CreateOpenAiClientOptions): OpenAiClient {
  return {
    async generateJson({ prompt, schema }): Promise<string> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "avatar_matching_output",
              strict: true,
              schema,
            },
          },
        }),
      });

      if (!response.ok) {
        // レスポンス本文にAPIキーは含まれないが、念のためステータスとエラーコードだけを残す。
        const body = await response.text().catch(() => "");
        throw new Error(
          `INVALID_OUTPUT: OpenAI APIがエラーを返しました(status=${response.status})。${body.slice(0, 300)}`,
        );
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
      };
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error("INVALID_OUTPUT: OpenAIの応答が空でした。");
      }
      return text;
    },
  };
}
