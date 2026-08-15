import { avatarProfileOutputSchema, matchOutputSchema } from "@/lib/ai/schemas";
import type {
  AiProvider,
  AvatarProfileOutput,
  MatchInput,
  MatchOutput,
  ProfileInput,
} from "@/lib/ai/types";
// 型だけの参照。import typeはビルド時に消えるため、AI_PROVIDER=mockの経路でも実行時にSDKを読み込まない。
import type { Schema } from "@google/genai";

/** 既定モデル。2026-08時点のFlash系最新。2.0系は2026-06-01に停止済みのため使わない。 */
export const GEMINI_MODEL = "gemini-3.6-flash";

/** 生成1回あたりの上限。SC-009の「30秒以内に失敗表示」に収まるようにする。 */
export const GEMINI_TIMEOUT_MS = 12_000;

/**
 * Gemini呼び出しの最小境界。
 * SDKを直接持ち込まずJSON文字列だけを返させることで、テストで通信を差し替えられる。
 */
export type GeminiClient = {
  generateJson(request: { prompt: string; schema: unknown }): Promise<string>;
};

type GeminiProviderOptions = {
  client: GeminiClient;
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
      type: "array",
      items: {
        type: "object",
        properties: {
          turnIndex: { type: "integer" },
          speaker: { type: "string", enum: ["user_avatar", "candidate_avatar"] },
          body: { type: "string" },
          answerRefs: { type: "array", items: { type: "string" } },
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

/** 回答を質問コード付きの一覧にする。本文はPrivacySafeAiProvider側で秘匿済みの想定。 */
function formatAnswers(answers: ProfileInput["answers"]): string {
  return answers
    .slice()
    .sort((left, right) => left.questionCode.localeCompare(right.questionCode))
    .map(({ questionCode, answer }) => `${questionCode}: ${answer}`)
    .join("\n");
}

const SHARED_RULES = [
  "氏名、会社名、部署名、住所、電話番号、メールアドレス、URLを一切書かないこと。",
  "回答者本人が書いていない事実を推測して足さないこと。",
  "国籍、信条、病歴、性的指向などの機微な属性を推測しないこと。",
  "出力は指定されたJSON構造のみとし、説明文やコードブロックを付けないこと。",
].join("\n");

function buildProfilePrompt(input: ProfileInput): string {
  return [
    "あなたは、ある人物の回答から「その人の代わりに会話するAIアバター」の人物像を要約します。",
    "",
    "## 回答",
    formatAnswers(input.answers),
    "",
    "## 出力の要件",
    "- summary: その人の人柄が伝わる自然な日本語の要約。250文字以内。",
    "- traits: 以下6つの観点をそれぞれ100文字以内で書く。",
    "  leisure(休日の過ごし方) / communication(人との関わり方) / lifestyle(生活のリズム)",
    "  / values(大切にしている価値観) / relationships(関係の築き方) / priorities(優先していること)",
    "- 回答に書かれた内容だけを根拠にすること。",
    "",
    "## 禁止事項",
    SHARED_RULES,
  ].join("\n");
}

function buildMatchPrompt(input: MatchInput): string {
  return [
    "2人のAIアバターが、それぞれの本人に代わって初対面の会話をします。",
    "その会話文と、会話にもとづく相性評価を作ってください。",
    "",
    "## あなたが代弁する人物(user_avatar)の回答",
    formatAnswers(input.answers),
    "",
    "## その人物の要約",
    input.profile.summary,
    "",
    `## 相手(candidate_avatar)の情報 呼称: ${input.candidate.avatarAlias}`,
    JSON.stringify(input.candidate.conversationProfile),
    "",
    "## 会話の要件",
    "- 8〜12発言。turnIndexは1から連番。奇数がuser_avatar、偶数がcandidate_avatarで交互に話す。",
    "- 実際に人が話しているような自然な日本語にすること。定型文の言い換えや、回答の丸写しにしない。",
    "- 相手の発言を受けて話を展開すること。相槌、質問、共感、軽い笑いを含めてよい。",
    "- 1発言は120文字以内を目安にする。",
    "- 各発言のanswerRefsに、その発言の根拠にした質問コード(q01〜q20の形式)を1つ以上入れる。",
    "- 会話全体で、異なる質問を3つ以上反映すること。",
    "",
    "## 相性評価の要件",
    "- dimensionsは必ず次の5軸を1つずつ、重複なく含める。",
    "  conversation_flow(会話の弾み) / values_alignment(価値観の一致) / humor_fit(ユーモアの相性)",
    "  / mutual_interest(相互の関心) / mismatch_severity(不一致の重大度)",
    "- scoreは0〜100の整数。mismatch_severityだけは低いほど良い評価を意味する。",
    "- explanationは根拠を説明する150文字以内の日本語。",
    "- evidenceTurnIndexは、その評価の根拠にした実在する発言のturnIndexを指すこと。",
    "- overallScoreは0〜100の整数。summaryは総評、cautionは気をつけると良い点。",
    "",
    "## 禁止事項",
    SHARED_RULES,
  ].join("\n");
}

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("INVALID_OUTPUT: Geminiの応答をJSONとして解釈できませんでした。");
  }
}

/**
 * Geminiを使うAiProvider。
 * 出力はZod契約で再検証し、満たさない場合は1度だけ作り直す。
 * それでも満たさなければINVALID_OUTPUTとして失敗させ、不正な会話を保存しない。
 */
export class GeminiAiProvider implements AiProvider {
  readonly providerId = `gemini:${GEMINI_MODEL}`;

  private readonly client: GeminiClient;
  private readonly timeoutMs: number;

  constructor({ client, timeoutMs = GEMINI_TIMEOUT_MS }: GeminiProviderOptions) {
    this.client = client;
    this.timeoutMs = timeoutMs;
  }

  async generateProfile(input: ProfileInput): Promise<AvatarProfileOutput> {
    return this.generateValidated(
      buildProfilePrompt(input),
      profileResponseSchema,
      (value) => avatarProfileOutputSchema.parse(value),
    );
  }

  async generateMatch(input: MatchInput): Promise<MatchOutput> {
    return this.generateValidated(
      buildMatchPrompt(input),
      matchResponseSchema,
      (value) => matchOutputSchema.parse(value),
    );
  }

  /** 生成して契約検証する。検証に落ちた場合だけ1度作り直す。 */
  private async generateValidated<T>(
    prompt: string,
    schema: unknown,
    validate: (value: unknown) => T,
  ): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const raw = await this.callWithTimeout(prompt, schema);
      try {
        return validate(parseJson(raw));
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error("INVALID_OUTPUT: Geminiの出力が契約を満たしませんでした。", { cause: lastError });
  }

  private async callWithTimeout(prompt: string, schema: unknown): Promise<string> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.client.generateJson({ prompt, schema }),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error("TIMEOUT: Geminiの応答が制限時間を超えました。")), this.timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
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
      const { GoogleGenAI } = await import("@google/genai");
      const client = new GoogleGenAI({ apiKey });
      const response = await client.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: schema as Schema,
        },
      });
      const text = response.text;
      if (!text) {
        throw new Error("INVALID_OUTPUT: Geminiの応答が空でした。");
      }
      return text;
    },
  };
}
