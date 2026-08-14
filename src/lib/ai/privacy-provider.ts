import { INTERVIEW_QUESTIONS } from "@/features/interview/domain";
import { avatarProfileOutputSchema, matchOutputSchema, redactPotentialPii } from "@/lib/ai/schemas";
import type {
  AiAnswer,
  AiProvider,
  AvatarProfileOutput,
  MatchInput,
  MatchOutput,
  ProfileInput,
} from "@/lib/ai/types";

const PRIVATE_ANSWER_PLACEHOLDER = "[自由記述は安全のため非公開]";
const freeTextCodes = new Set(
  INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "free_text").map(({ code }) => code),
);

function normalizeForComparison(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ja-JP")
    .replace(/[\p{White_Space}\p{P}\p{S}]/gu, "");
}

function identifyingFragments(value: string): string[] {
  // email・電話などの定型識別子は出力schemaの専用patternで検査し、machine enumとの偶然一致を避ける。
  if (redactPotentialPii(value) !== value) return [];
  const codePoints = Array.from(normalizeForComparison(value));
  if (codePoints.length < 4) return [];

  const fragments = Array.from(
    { length: codePoints.length - 3 },
    (_, index) => codePoints.slice(index, index + 4).join(""),
  );
  return [...new Set(fragments)];
}

function outputStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(outputStrings);
  if (value && typeof value === "object") return Object.values(value).flatMap(outputStrings);
  return [];
}

function assertNoPrivateAnswerLeak(rawAnswers: readonly AiAnswer[], output: unknown): void {
  const fragments = rawAnswers
    .filter(({ questionCode }) => freeTextCodes.has(questionCode))
    .flatMap(({ answer }) => identifyingFragments(answer));
  const normalizedOutput = outputStrings(output).map(normalizeForComparison);

  if (fragments.some((fragment) => normalizedOutput.some((text) => text.includes(fragment)))) {
    throw new Error("AI出力に自由記述由来の識別情報が含まれています。");
  }
}

function sanitizeAnswers(answers: readonly AiAnswer[]): AiAnswer[] {
  return answers.map((answer) => freeTextCodes.has(answer.questionCode)
    ? { ...answer, answer: PRIVATE_ANSWER_PLACEHOLDER }
    : { ...answer });
}

/** Provider実装へ自由記述の原文を渡さない共通プライバシー境界。 */
export class PrivacySafeAiProvider implements AiProvider {
  readonly providerId: string;

  constructor(private readonly inner: AiProvider) {
    this.providerId = inner.providerId;
  }

  async generateProfile(input: ProfileInput): Promise<AvatarProfileOutput> {
    const output = avatarProfileOutputSchema.parse(await this.inner.generateProfile({
      ...input,
      answers: sanitizeAnswers(input.answers),
    }));
    assertNoPrivateAnswerLeak(input.answers, output);
    return output;
  }

  async generateMatch(input: MatchInput): Promise<MatchOutput> {
    const output = matchOutputSchema.parse(await this.inner.generateMatch({
      ...input,
      answers: sanitizeAnswers(input.answers),
    }));
    assertNoPrivateAnswerLeak(input.answers, output);
    return output;
  }
}
