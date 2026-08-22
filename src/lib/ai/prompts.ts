import { INTERVIEW_QUESTION_CODES } from "@/features/interview/domain";
import type { MatchInput, ProfileInput } from "@/lib/ai/types";

/**
 * プロンプト構築ロジック。GeminiAiProviderとOpenAiProviderの両方から参照される共通部分。
 * プロバイダーごとの差異(response schemaの表現形式、クライアントの呼び出し方)は
 * 各providerファイル側に閉じ込め、プロンプトの文面はここに一本化する。
 * 文面を二重管理すると、片方だけ「濃密さ」の指示を直しても他方に反映されない事故が起きるため。
 */

/** 回答参照に使える質問コード。schema側でenum化しないとモデルが独自の文字列を返す。 */
export const ANSWER_REF_CODES = INTERVIEW_QUESTION_CODES;

export const SHARED_RULES = [
  "氏名、会社名、部署名、住所、電話番号、メールアドレス、URLを一切書かないこと。",
  "回答者本人が書いていない事実を推測して足さないこと。",
  "国籍、信条、病歴、性的指向などの機微な属性を推測しないこと。",
  "出力は指定されたJSON構造のみとし、説明文やコードブロックを付けないこと。",
].join("\n");

/** 回答を質問コード付きの一覧にする。本文はPrivacySafeAiProvider側で秘匿済みの想定。 */
export function formatAnswers(answers: ProfileInput["answers"]): string {
  return answers
    .slice()
    .sort((left, right) => left.questionCode.localeCompare(right.questionCode))
    .map(({ questionCode, answer }) => `${questionCode}: ${answer}`)
    .join("\n");
}

export function buildProfilePrompt(input: ProfileInput): string {
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

export function buildMatchPrompt(input: MatchInput): string {
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
    "## 会話の要件(最重要: 発言数だけ多くて中身が薄い会話は不合格)",
    "- 24〜36発言。turnIndexは1から連番。奇数がuser_avatar、偶数がcandidate_avatarで交互に話す。",
    "- 実際に人が話しているような自然な日本語にすること。定型文の言い換えや、回答の丸写しにしない。",
    "- 会話は4〜7個程度の話題のまとまりで構成すること。ひとつの話題を3〜6発言ほど深掘りしてから、",
    "  相手の発言・共通点・ふとした疑問など自然なきっかけで次の話題へ移ること。",
    "  話題が変わらないまま会話全体が続く、または脈絡なく話題が飛ぶのはどちらも不可。",
    "- 深掘りでは、回答に書かれた具体的な内容(エピソード、理由、頻度・程度、きっかけなど)に",
    "  踏み込んで話すこと。「〇〇が好きなんですね」で終わらせず、なぜ好きか、",
    "  どんな場面か、どのくらいの頻度かまで会話の中で触れること。",
    "- 同じ話題を後半で蒸し返したり、似た言い回しの発言を繰り返したりしないこと。",
    "- 内容のない相槌(「そうなんですね」「いいですね」「素敵ですね」など)だけの発言で",
    "  発言数を水増ししないこと。相槌を使う場合も、必ず具体的な質問・気づき・自分の経験を",
    "  添えて次の発言へつなげること。",
    "- 1発言は120文字以内を目安にする。",
    "- 各発言のanswerRefsに、その発言の根拠にした質問コード(qに数字が続く形式)を1つ以上入れる。",
    "- 会話全体で、異なる質問を10個以上反映すること。特定の1〜2問だけを繰り返し話題にせず、",
    "  複数の話題にまたがって回答内容を織り込むこと。",
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
