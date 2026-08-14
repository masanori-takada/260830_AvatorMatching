import { avatarProfileOutputSchema, matchOutputSchema } from "@/lib/ai/schemas";
import type { AiProvider, MatchInput, MatchOutput, ProfileInput, AvatarProfileOutput } from "@/lib/ai/types";

const answerAt = (input: ProfileInput, code: string) =>
  input.answers.find((answer) => answer.questionCode === code)?.answer ?? "未回答";

const safeAnswerAt = (input: ProfileInput, code: string) =>
  Array.from(answerAt(input, code)).slice(0, 80).join("");

export class MockAiProvider implements AiProvider {
  readonly providerId = "mock-v1";

  async generateProfile(input: ProfileInput): Promise<AvatarProfileOutput> {
    return avatarProfileOutputSchema.parse({
      summary: `q01「${safeAnswerAt(input, "q01")}」、q02「${safeAnswerAt(input, "q02")}」、q03「${safeAnswerAt(input, "q03")}」という回答から、無理のないペースと対話を大切にする人物像が見えます。`,
      traits: {
        leisure: `休日傾向: q01「${safeAnswerAt(input, "q01") }」`,
        communication: `交流傾向: q02「${safeAnswerAt(input, "q02") }」`,
        lifestyle: `計画傾向: q03「${safeAnswerAt(input, "q03") }」`,
        values: "誠実な対話を大切にします。",
        relationships: "相手のペースを尊重します。",
        priorities: "無理のない継続性を重視します。",
      },
    });
  }

  async generateMatch(input: MatchInput): Promise<MatchOutput> {
    const evidence = ["q01", "q02", "q03"].map((code) => ({
      code,
      value: safeAnswerAt(input, code),
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
    return matchOutputSchema.parse({
      messages,
      report: {
        overallScore: 76,
        summary: "会話のペースと日常の過ごし方に共通点があります。",
        caution: "違いは早めに言葉で確認すると安心です。",
        dimensions: axes.map((axis, index) => ({
          axis,
          score: axis === "mismatch_severity" ? 28 : 72 + index,
          explanation: `${index + 1}番目の発言を根拠にした評価です。`,
          evidenceTurnIndex: index + 1,
        })),
      },
    });
  }
}
