export type AiAnswer = {
  questionCode: `q${string}`;
  answer: string;
  revision: number;
};

/** 旧要約生成APIの互換型。画面・マッチング経路からは使用しない。 */
export type ProfileInput = { answers: AiAnswer[] };

/** 旧要約生成APIの互換型。会話生成は全回答を直接使用する。 */
export type AvatarProfileOutput = {
  summary: string;
  traits: Record<string, string>;
};

export type MatchInput = {
  answers: AiAnswer[];
  /** 旧テストデータとの互換用。会話生成プロンプトでは参照しない。 */
  profile?: AvatarProfileOutput;
  candidate: {
    avatarAlias: string;
    conversationProfile: Record<string, unknown>;
  };
};

export type MatchOutput = {
  messages: Array<{
    turnIndex: number;
    speaker: "user_avatar" | "candidate_avatar";
    body: string;
    answerRefs: string[];
  }>;
  report: {
    overallScore: number;
    summary: string;
    caution: string;
    dimensions: Array<{
      axis: "conversation_flow" | "values_alignment" | "humor_fit" | "mutual_interest" | "mismatch_severity";
      score: number;
      explanation: string;
      evidenceTurnIndex: number;
    }>;
  };
};

export interface AiProvider {
  readonly providerId: string;
  /** 旧要約生成APIの互換用。利用者向け経路からは呼び出さない。 */
  generateProfile(input: ProfileInput): Promise<AvatarProfileOutput>;
  generateMatch(input: MatchInput): Promise<MatchOutput>;
}
