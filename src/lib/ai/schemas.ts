import { z } from "zod";

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
    answerRefs: z.array(z.string().regex(/^q(?:0[1-9]|1[0-9]|20)$/)).refine(
      (refs) => new Set(refs).size === refs.length,
      "answerRefsは発言内で重複できません。",
    ),
  })).min(8).max(20),
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
