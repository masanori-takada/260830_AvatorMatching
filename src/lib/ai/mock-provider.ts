import { assertAnswerRefsAreDisclosed, avatarProfileOutputSchema, matchOutputSchema } from "@/lib/ai/schemas";
import type { AiAnswer, AiProvider, AvatarProfileOutput, MatchInput, MatchOutput, ProfileInput } from "@/lib/ai/types";

const answerAt = (answers: readonly AiAnswer[], code: string) =>
  answers.find((answer) => answer.questionCode === code)?.answer ?? "未回答";

const safeAnswerAt = (answers: readonly AiAnswer[], code: string) =>
  Array.from(answerAt(answers, code)).slice(0, 80).join("");

// 候補アバターの匿名エイリアスから決定論的な整数を作る。3人の候補で結果が
// 全部同じだと「複数の相手と会話した」という体験の一覧が意味をなさないため、
// これを種にスコアと総評の文面を候補ごとに変える(同じ入力なら常に同じ出力にはなる)。
function hashAlias(alias: string): number {
  let hash = 0;
  for (const char of alias) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return hash;
}

const SUMMARY_TEMPLATES = [
  (alias: string) => `${alias}とは会話のテンポが合い、気負わず話せる相手だと感じられました。`,
  (alias: string) => `${alias}とは価値観の共通点が多く、落ち着いて話を深められました。`,
  (alias: string) => `${alias}とは慎重に距離を測り合う、丁寧な会話になりました。`,
] as const;

const CAUTION_TEMPLATES = [
  (alias: string) => `${alias}とは生活リズムに違いもあるため、早めに言葉で確認すると安心です。`,
  (alias: string) => `${alias}とは初対面の距離感に差があるため、ペースを合わせる工夫が役立ちます。`,
  (alias: string) => `${alias}とは会話のテンポに差があるため、無理に合わせすぎないことも大切です。`,
] as const;

export class MockAiProvider implements AiProvider {
  readonly providerId = "mock-v1";

  async generateProfile(input: ProfileInput): Promise<AvatarProfileOutput> {
    return avatarProfileOutputSchema.parse({
      summary: `q01「${safeAnswerAt(input.answers, "q01")}」、q02「${safeAnswerAt(input.answers, "q02")}」、q03「${safeAnswerAt(input.answers, "q03")}」という回答から、無理のないペースと対話を大切にする人物像が見えます。`,
      traits: {
        leisure: `休日傾向: q01「${safeAnswerAt(input.answers, "q01")}」`,
        communication: `交流傾向: q02「${safeAnswerAt(input.answers, "q02")}」`,
        lifestyle: `計画傾向: q03「${safeAnswerAt(input.answers, "q03")}」`,
        values: "誠実な対話を大切にします。",
        relationships: "相手のペースを尊重します。",
        priorities: "無理のない継続性を重視します。",
      },
    });
  }

  async generateMatch(input: MatchInput): Promise<MatchOutput> {
    const evidence = ["q01", "q02", "q03"].map((code) => ({
      code,
      value: safeAnswerAt(input.answers, code),
    }));
    const messages = Array.from({ length: 8 }, (_, index) => {
      const item = evidence[Math.floor(index / 2) % evidence.length]!;
      return {
        turnIndex: index + 1,
        speaker: index % 2 === 0 ? "user_avatar" as const : "candidate_avatar" as const,
        body: index % 2 === 0
          ? `${item.code}の「${item.value}」という回答を共有しました。`
          : `${input.candidate.avatarAlias}の匿名プロフィールと照らして共通点を確かめました。`,
        answerRefs: [item.code],
      };
    });
    const axes = [
      "conversation_flow", "values_alignment", "humor_fit", "mutual_interest", "mismatch_severity",
    ] as const;
    const alias = input.candidate.avatarAlias;
    const seed = hashAlias(alias);
    // overallScoreは58〜92、mismatch_severityは12〜41、他4軸は55〜94の範囲で
    // 候補ごとに変える(全員同じ結果にならないようにするため)。
    const overallScore = 58 + (seed % 35);
    const output = matchOutputSchema.parse({
      messages,
      report: {
        overallScore,
        summary: SUMMARY_TEMPLATES[seed % SUMMARY_TEMPLATES.length]!(alias),
        caution: CAUTION_TEMPLATES[seed % CAUTION_TEMPLATES.length]!(alias),
        dimensions: axes.map((axis, index) => {
          const shifted = (seed >>> (index * 3 + 1)) % 30;
          const score = axis === "mismatch_severity" ? 12 + shifted : 55 + shifted + index * 2;
          return {
            axis,
            score: Math.min(100, score),
            explanation: `${alias}との${index + 1}番目の発言を根拠にした評価です。`,
            evidenceTurnIndex: index + 1,
          };
        }),
      },
    });
    // モックはq01〜q03だけを参照するため通常は違反しないが、GeminiAiProviderと同じ検査を
    // 通すことで、実際に渡した回答コード以外を参照していないことを保証する
    // (検査の実装自体はsrc/lib/ai/schemas.tsに一元化し、ここでは重複させない)。
    const disclosedAnswerCodes = new Set(input.answers.map(({ questionCode }) => questionCode));
    return assertAnswerRefsAreDisclosed(output, disclosedAnswerCodes);
  }
}
