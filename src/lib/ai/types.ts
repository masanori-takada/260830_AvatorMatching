export type AiAnswer = {
  questionCode: `q${string}`;
  answer: string;
  revision: number;
};

export type ProfileInput = { answers: AiAnswer[] };

export type AvatarProfileOutput = {
  summary: string;
  traits: Record<string, string>;
};

export type MatchInput = {
  answers: AiAnswer[];
  profile: AvatarProfileOutput;
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
  generateProfile(input: ProfileInput): Promise<AvatarProfileOutput>;
  generateMatch(input: MatchInput): Promise<MatchOutput>;
}
