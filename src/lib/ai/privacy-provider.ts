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

function normalizeCandidate(value: string): string {
  return normalizeForComparison(value)
    .replace(/(?:で働いています|に所属しています|と申します|といいます|と言います|です)$/u, "");
}

/** 自由記述から、明示的に識別情報として示された値だけを抽出する。 */
export function extractSensitiveFragments(value: string): string[] {
  // 定型PIIは出力schemaの専用patternへ委譲し、除去後の文章からも候補抽出を続ける。
  const scrubbed = redactPotentialPii(value.normalize("NFKC")).replace(/\[[^\]]+\]/gu, " ");
  const candidates: string[] = [];
  const labelPattern = /(?:名前|氏名|会社|勤務先|所属|部署|住所|連絡先)\s*(?:は|:|：)?\s*([^。、,!！?？\n\r]+)/gu;
  const introductionPattern = /(?:^|[。、.!！?？])\s*([\p{L}・\s]{2,16}?)(?:と申します|といいます|と言います)/gu;
  const nameWithCopulaPattern = /(?:^|[。、.!！?？])\s*([\p{Script=Han}\s・]{2,20}?)です/gu;

  for (const pattern of [labelPattern, introductionPattern]) {
    for (const match of scrubbed.matchAll(pattern)) candidates.push(match[1] ?? "");
  }
  for (const match of scrubbed.matchAll(nameWithCopulaPattern)) {
    const candidate = normalizeCandidate(match[1] ?? "");
    const length = Array.from(candidate).length;
    if (length >= 3 && length <= 8) candidates.push(candidate);
  }

  const standalone = scrubbed.trim();
  if (
    /^\p{Script=Han}{3,8}$/u.test(standalone)
    || /^[\p{L}]{1,4}[\s・]+[\p{L}]{1,4}$/u.test(standalone)
  ) {
    candidates.push(standalone);
  }

  return [...new Set(candidates.map(normalizeCandidate).filter((candidate) => {
    const length = Array.from(candidate).length;
    return length >= 2 && length <= 80;
  }))];
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
    .flatMap(({ answer }) => extractSensitiveFragments(answer));
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
