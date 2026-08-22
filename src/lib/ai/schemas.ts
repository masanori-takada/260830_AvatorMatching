import { z } from "zod";

import { INTERVIEW_QUESTION_CODES } from "@/features/interview/domain";

const piiPatterns = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/iu,
  /(?:https?:\/\/|www\.)\S+/iu,
  /〒?\s*\d{3}-?\d{4}/u,
  /(?:^|\D)0\d{1,4}[-－ー\s]?\d{1,4}[-－ー\s]?\d{3,4}(?:\D|$)/u,
  /星乃\s*ルナ（完全架空）/u,
  /ルミナス架空企画株式会社（完全架空）/u,
  /未来対話デザイン室（完全架空）/u,
];

function findPiiPath(value: unknown, path: PropertyKey[] = []): PropertyKey[] | null {
  if (typeof value === "string") {
    return piiPatterns.some((pattern) => pattern.test(value)) ? path : null;
  }
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = findPiiPath(item, [...path, index]);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const found = findPiiPath(item, [...path, key]);
      if (found) return found;
    }
  }
  return null;
}

function rejectPotentialPii(value: unknown, context: z.RefinementCtx) {
  const path = findPiiPath(value);
  if (path) {
    context.addIssue({ code: "custom", message: "識別情報を含む可能性がある文字列です。", path });
  }
}

export function redactPotentialPii(value: string): string {
  return piiPatterns.reduce(
    (current, pattern) => current.replace(new RegExp(pattern.source, `${pattern.flags}g`), "[非公開]"),
    value,
  );
}

const traitSchema = z.string().min(1).max(200);

/** 旧要約生成APIの互換契約。現行の画面・マッチング経路からは使用しない。 */
export const avatarProfileOutputSchema = z.strictObject({
  summary: z.string().min(1).max(600),
  traits: z.strictObject({
    leisure: traitSchema,
    communication: traitSchema,
    lifestyle: traitSchema,
    values: traitSchema,
    relationships: traitSchema,
    priorities: traitSchema,
  }),
}).superRefine(rejectPotentialPii);

const axisSchema = z.enum([
  "conversation_flow",
  "values_alignment",
  "humor_fit",
  "mutual_interest",
  "mismatch_severity",
]);

export const matchOutputSchema = z.strictObject({
  messages: z.array(z.strictObject({
    turnIndex: z.number().int().min(1),
    speaker: z.enum(["user_avatar", "candidate_avatar"]),
    body: z.string().min(1).max(1000),
    // 参照可能な質問コードはdomain.tsのINTERVIEW_QUESTIONSから導出する。
    answerRefs: z.array(z.enum(INTERVIEW_QUESTION_CODES)).min(1).refine(
      (refs) => new Set(refs).size === refs.length,
      "answerRefsは発言内で重複できません。",
    ),
  // 24〜36発言を狙うプロンプト・response schema(gemini-provider.ts/openai-provider.ts)に対し、
  // Zod側はモック(8発言)との互換を保つため下限は8のまま、上限だけ3倍相当(36)へ広げる。
  })).min(8).max(36),
  report: z.strictObject({
    overallScore: z.number().int().min(0).max(100),
    summary: z.string().min(1).max(1000),
    caution: z.string().min(1).max(500),
    dimensions: z.array(z.strictObject({
      axis: axisSchema,
      score: z.number().int().min(0).max(100),
      explanation: z.string().min(1).max(500),
      evidenceTurnIndex: z.number().int().min(1),
    })).length(5),
  }),
}).superRefine((output, context) => {
  rejectPotentialPii(output, context);
  const axes = output.report.dimensions.map(({ axis }) => axis);
  if (new Set(axes).size !== 5) {
    context.addIssue({ code: "custom", message: "5軸は重複できません。", path: ["report", "dimensions"] });
  }
  const turns = new Set(output.messages.map(({ turnIndex }) => turnIndex));
  for (const [index, dimension] of output.report.dimensions.entries()) {
    if (!turns.has(dimension.evidenceTurnIndex)) {
      context.addIssue({ code: "custom", message: "引用元の発言が存在しません。", path: ["report", "dimensions", index, "evidenceTurnIndex"] });
    }
  }
  const referencedAnswers = new Set(output.messages.flatMap(({ answerRefs }) => answerRefs));
  if (referencedAnswers.size < 3) {
    context.addIssue({ code: "custom", message: "3回答以上の根拠が必要です。", path: ["messages"] });
  }
});

/**
 * answerRefsが「実際にAIへ渡した回答コード」の部分集合であることを検証する。
 *
 * matchOutputSchemaのanswerRefsはINTERVIEW_QUESTION_CODES全体(41問)をenumとして許可している
 * (静的なzod schemaは、リクエストごとに変わる「実際に渡した回答」を表現できないため)。
 * しかし開示同意が無いデリケートな回答はAIへ渡していない(getOwnedMatchInput/completeInterviewが
 * 事前に除外している)。それにもかかわらずAIがそのコードをanswerRefsに含めると、値そのものは
 * 漏れなくても「この項目について会話された」という体裁だけが利用者に見えてしまい、
 * 開示同意の仕組みの意味を損なう。
 *
 * そのためAI出力を受け取った直後に、実際に渡した回答コードの集合(disclosedAnswerCodes)と
 * 突き合わせて検証する。GeminiAiProvider/MockAiProviderの両方から呼ばれる共通経路とし、
 * 同じ検査が2箇所に重複して書かれることを避ける。
 *
 * GeminiAiProvider側はこの関数をgenerateValidatedのvalidateコールバック内で呼ぶことで、
 * 既存の契約違反時の再試行(1度だけ作り直す)にそのまま乗る。
 */
export function assertAnswerRefsAreDisclosed<T extends { messages: readonly { answerRefs: readonly string[] }[] }>(
  output: T,
  disclosedAnswerCodes: ReadonlySet<string>,
): T {
  const undisclosedCode = output.messages
    .flatMap(({ answerRefs }) => answerRefs)
    .find((code) => !disclosedAnswerCodes.has(code));
  if (undisclosedCode !== undefined) {
    throw new Error(
      `answerRefsに、AIへ渡していない質問コード(${undisclosedCode})が含まれています。`,
    );
  }
  return output;
}
