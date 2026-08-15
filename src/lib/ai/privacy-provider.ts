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

const freeTextCodes = new Set(
  INTERVIEW_QUESTIONS.filter(({ kind }) => kind === "free_text").map(({ code }) => code),
);

// ラベル付き識別記述(名前は◯◯等)と自己紹介(◯◯と申します等)。
// extractSensitiveFragments(抽出・出口の漏洩検査用)とredactSelfDisclosedIdentity(除去・入口用)の
// 両方で同じパターンを使う。matchAll/replaceはグローバルフラグ付きregexのlastIndexを
// 呼び出しごとに0へ戻して評価するため、同じ正規表現オブジェクトを使い回しても安全。
// 助詞・コロンは必須。省略可能にすると「会社の同僚と飲みに行くのが好きです」のような通常の文まで
// 一致し、除去時に本文全体が消える。
const LABEL_PATTERN = /(?:名前|氏名|会社|勤務先|所属|部署|住所|連絡先)\s*(?:は|:|：)\s*([^。、,!！?？\n\r]+)/gu;
const INTRODUCTION_PATTERN = /(?:^|[。、.!！?？])\s*([\p{L}・\s]{2,16}?)(?:と申します|といいます|と言います)/gu;
const NAME_WITH_COPULA_PATTERN = /(?:^|[。、.!！?？])\s*([\p{Script=Han}\s・]{2,20}?)です/gu;
const STANDALONE_HAN_PATTERN = /^\p{Script=Han}{3,8}$/u;
const STANDALONE_SPACED_PATTERN = /^[\p{L}]{1,4}[\s・]+[\p{L}]{1,4}$/u;
const IDENTITY_PLACEHOLDER = "[非公開]";

/** 氏名候補として扱う長さか。2字の一般語(「読書」等)を氏名扱いしないための下限。 */
function isNameLikeLength(candidate: string): boolean {
  const length = Array.from(candidate).length;
  return length >= 3 && length <= 8;
}

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

  for (const pattern of [LABEL_PATTERN, INTRODUCTION_PATTERN]) {
    for (const match of scrubbed.matchAll(pattern)) candidates.push(match[1] ?? "");
  }
  for (const match of scrubbed.matchAll(NAME_WITH_COPULA_PATTERN)) {
    const candidate = normalizeCandidate(match[1] ?? "");
    if (isNameLikeLength(candidate)) candidates.push(candidate);
  }

  const standalone = scrubbed.trim();
  if (STANDALONE_HAN_PATTERN.test(standalone) || STANDALONE_SPACED_PATTERN.test(standalone)) {
    candidates.push(standalone);
  }

  return [...new Set(candidates.map(normalizeCandidate).filter((candidate) => {
    const length = Array.from(candidate).length;
    return length >= 2 && length <= 80;
  }))];
}

/**
 * 自由記述の本文から、明示的な識別情報だけを除去する。趣味・価値観などの内容そのものは残す。
 * 定型PII(メール・URL・電話・郵便番号・候補者実名)はredactPotentialPiiに委譲する。
 *
 * extractSensitiveFragments(出口の漏洩検査)と**同じパターン集合**を使う点が重要。
 * 出口が識別情報とみなす語をAIへ渡さなければ、AIはそれを出力に含めようがない。
 * 逆に片方だけ緩いと、AIが正当に反映した本文が漏洩と誤判定され、再試行しても回復しない
 * 行き詰まりになる。
 */
export function redactSelfDisclosedIdentity(value: string): string {
  const withoutPii = redactPotentialPii(value.normalize("NFKC"));

  // 回答全体が氏名の形をしている場合(「李 雷」「山田太郎」等)は丸ごと伏せる。
  const standalone = withoutPii.trim();
  if (STANDALONE_HAN_PATTERN.test(standalone) || STANDALONE_SPACED_PATTERN.test(standalone)) {
    return IDENTITY_PLACEHOLDER;
  }

  const keepLeadingPunctuation = (matched: string, replacement: string): string => {
    const leading = /^[。、.!！?？]/u.exec(matched)?.[0] ?? "";
    return `${leading}${replacement}`;
  };

  return withoutPii
    .replace(LABEL_PATTERN, IDENTITY_PLACEHOLDER)
    .replace(INTRODUCTION_PATTERN, (matched) => keepLeadingPunctuation(matched, IDENTITY_PLACEHOLDER))
    .replace(NAME_WITH_COPULA_PATTERN, (matched, captured: string) => (
      // 2字の一般語(「読書です」等)は氏名扱いせず、本文として残す。
      isNameLikeLength(normalizeCandidate(captured))
        ? keepLeadingPunctuation(matched, `${IDENTITY_PLACEHOLDER}です`)
        : matched
    ));
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
    ? { ...answer, answer: redactSelfDisclosedIdentity(answer.answer) }
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
