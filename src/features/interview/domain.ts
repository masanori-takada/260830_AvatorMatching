export type InterviewQuestionCode = `q${string}`;

// デリケートな質問が属する開示グループ。質問がどのグループに属するかは
// INTERVIEW_QUESTIONS(このファイル)の1箇所だけで決め、他の場所(AIへの入力組み立て等)は
// この値を参照するだけにする。判定ロジックを各所に散らさないための一元管理ポイント。
export type SensitiveGroup = "income" | "career_education" | "appearance" | "family_marital";

// 開示意思を尋ねる質問(q38〜q41)のカテゴリ。UI側はこのカテゴリと一致するかどうかで
// 「開示意思の補足説明」を出すかを判断する(質問文言そのものをUI側で複製しない)。
export const DISCLOSURE_CATEGORY = "開示の希望";

// 開示意思の選択肢文言。単一箇所で定義し、判定(isDisclosureConsentGiven)とDB定義の両方から参照する。
export const DISCLOSURE_CONSENT_OK = "アバター同士の会話で触れてよい";
export const DISCLOSURE_CONSENT_NG = "会ってから自分で話したい";

export type ChoiceQuestion = {
  code: InterviewQuestionCode;
  displayOrder: number;
  category: string;
  kind: "choice";
  prompt: string;
  // 選択肢は質問ごとに数が異なる(例: 婚姻歴は3択、職業は10択)ため可変長にする。
  // DB側のjsonb_array_length制約(2〜12)と対応させること。
  choices: readonly string[];
  minLength: null;
  maxLength: null;
  // この質問自体がデリケートな回答か。デリケートでなければnull。
  sensitiveGroup: SensitiveGroup | null;
  // この質問が、どの開示グループへの開示意思を尋ねる質問か。通常の質問はnull。
  consentForGroup: SensitiveGroup | null;
};

export type FreeTextQuestion = {
  code: InterviewQuestionCode;
  displayOrder: number;
  category: string;
  kind: "free_text";
  prompt: string;
  choices: readonly [];
  minLength: 1;
  maxLength: 500;
  sensitiveGroup: SensitiveGroup | null;
  consentForGroup: SensitiveGroup | null;
};

export type InterviewQuestion = ChoiceQuestion | FreeTextQuestion;

export type InterviewAnswer = {
  questionCode: InterviewQuestionCode;
  answer: string;
  revision: number;
};

export type SaveInterviewAnswerInput = {
  questionCode: InterviewQuestionCode;
  answer: string;
  expectedRevision: number | null;
};

export type SaveInterviewAnswerOutput = {
  revision: number;
  answeredCount: number;
  nextPath: string;
};

const choice = (
  code: InterviewQuestionCode,
  displayOrder: number,
  category: string,
  prompt: string,
  choices: readonly string[],
  options?: { sensitiveGroup?: SensitiveGroup; consentForGroup?: SensitiveGroup },
): ChoiceQuestion => ({
  code,
  displayOrder,
  category,
  kind: "choice",
  prompt,
  choices,
  minLength: null,
  maxLength: null,
  sensitiveGroup: options?.sensitiveGroup ?? null,
  consentForGroup: options?.consentForGroup ?? null,
});

const freeText = (
  code: InterviewQuestionCode,
  displayOrder: number,
  category: string,
  prompt: string,
): FreeTextQuestion => ({
  code,
  displayOrder,
  category,
  kind: "free_text",
  prompt,
  choices: [],
  minLength: 1,
  maxLength: 500,
  sensitiveGroup: null,
  consentForGroup: null,
});

// 承認済み仕様の固定質問。表示文言と順序はDBの参照データ(202608130002_interview.sql +
// 202608220001_interview_profile_questions.sql)と同期する。
//
// 【コードと表示順が一致しない理由】
// q01〜q20は初期リリース済みの質問で、保存済みのinterview_answersがquestion_codeを参照している。
// 後から追加した基本プロフィール17問(q21〜q37)と開示意思4問(q38〜q41)を表示順の先頭(1〜21)に
// 置きたいが、既存コードを振り直すと保存済み回答の意味がずれてしまう。そのためコードは追加順
// (q21〜)を保ち、displayOrderだけを「基本プロフィール17問=1〜17、開示意思4問=18〜21、
// 既存20問=22〜41」となるよう独立して割り当てている。
//
// 【デリケートな質問と開示意思の対応】
// sensitiveGroupを持つ質問(年収=income、職業・最終学歴=career_education、
// 身長・体型=appearance、婚姻歴・子どもの有無=family_marital)は、本人と相手の双方が
// 対応するconsentForGroup質問(q38〜q41)で「アバター同士の会話で触れてよい」を選んだ場合だけ
// AIへの入力に含めてよい。この判定はfilterDisclosableAnswers(このファイル内)に一元化し、
// 呼び出し側(src/features/matching/server/queries.ts等)は判定ロジックを複製しない。
export const INTERVIEW_QUESTIONS = [
  // --- 基本プロフィール (displayOrder 1〜11) ---
  choice("q21", 1, "基本プロフィール", "性別を教えてください", ["男性", "女性", "その他・回答しない"]),
  // 相手の性別本人の性別から決め打ちにせず、希望として尋ねる(不具合2対応)。
  // 表示順は本人の性別質問(q21)の直後に置く。start_match_run()はこの回答で
  // 候補者(demo_candidates.gender)を絞り込む。「こだわらない」なら絞り込まない。
  choice("q42", 2, "基本プロフィール", "どんな相手を紹介してほしいですか？", ["男性", "女性", "こだわらない"]),
  choice("q22", 3, "基本プロフィール", "年齢はどのくらいですか？", [
    "20代前半", "20代後半", "30代前半", "30代後半", "40代前半", "40代後半", "50代以上",
  ]),
  choice("q23", 4, "基本プロフィール", "お住まいの地域はどちらですか？", [
    "北海道・東北", "関東", "中部", "近畿", "中国・四国", "九州・沖縄", "海外",
  ]),
  choice("q24", 5, "基本プロフィール", "身長を教えてください", [
    "〜155cm", "156〜160cm", "161〜165cm", "166〜170cm", "171〜175cm", "176〜180cm", "181cm〜",
  ], { sensitiveGroup: "appearance" }),
  choice("q25", 6, "基本プロフィール", "体型に近いのはどれですか？", ["スリム", "標準", "筋肉質", "ぽっちゃり"], {
    sensitiveGroup: "appearance",
  }),
  choice("q26", 7, "基本プロフィール", "最終学歴を教えてください", ["高校卒", "専門・短大卒", "大学卒", "大学院卒", "その他"], {
    sensitiveGroup: "career_education",
  }),
  choice("q27", 8, "基本プロフィール", "お仕事は何をされていますか？", [
    "会社員", "経営者・役員", "公務員", "専門職（医療・法律など）", "技術職",
    "教育・研究職", "販売・サービス", "自営業・フリーランス", "学生", "その他",
  ], { sensitiveGroup: "career_education" }),
  choice("q28", 9, "基本プロフィール", "年収帯を教えてください", [
    "〜400万円", "400〜600万円", "600〜800万円", "800〜1000万円", "1000〜1500万円", "1500万円〜", "回答しない",
  ], { sensitiveGroup: "income" }),
  choice("q29", 10, "基本プロフィール", "お休みはいつが多いですか？", ["土日", "平日", "不定期"]),
  choice("q30", 11, "基本プロフィール", "今の暮らし方に近いのは？", ["一人暮らし", "家族と同居", "ルームシェア", "その他"]),
  // --- 結婚・交際 (displayOrder 12〜16) ---
  choice("q31", 12, "結婚・交際", "結婚歴について教えてください", ["未婚", "離別", "死別"], {
    sensitiveGroup: "family_marital",
  }),
  choice("q32", 13, "結婚・交際", "お子さんはいらっしゃいますか？", ["なし", "いる（同居）", "いる（別居）"], {
    sensitiveGroup: "family_marital",
  }),
  choice("q33", 14, "結婚・交際", "お子さんについての希望は？", ["欲しい", "欲しくない", "相手と相談して決めたい"]),
  choice("q34", 15, "結婚・交際", "結婚についての考えに近いのは？", [
    "すぐにでも", "2〜3年以内", "良い人がいれば", "今は考えていない",
  ]),
  choice("q35", 16, "結婚・交際", "会うまでの進め方で希望に近いのは？", [
    "まず会って話したい", "メッセージを重ねてから", "相手に合わせる",
  ]),
  // --- 生活習慣 (displayOrder 17〜18) ---
  choice("q36", 17, "生活習慣", "たばこは吸いますか？", ["吸わない", "吸う", "電子タバコのみ", "相手の前では吸わない"]),
  choice("q37", 18, "生活習慣", "お酒はどのくらい飲みますか？", ["飲まない", "少し飲む", "よく飲む"]),
  // --- 開示の希望 (displayOrder 19〜22)。対応するデリケートな質問より後ろに置く。 ---
  choice("q38", 19, DISCLOSURE_CATEGORY, "年収について、アバター同士の会話で触れてもよいですか？", [
    DISCLOSURE_CONSENT_OK, DISCLOSURE_CONSENT_NG,
  ], { consentForGroup: "income" }),
  choice("q39", 20, DISCLOSURE_CATEGORY, "お仕事・最終学歴について、アバター同士の会話で触れてもよいですか？", [
    DISCLOSURE_CONSENT_OK, DISCLOSURE_CONSENT_NG,
  ], { consentForGroup: "career_education" }),
  choice("q40", 21, DISCLOSURE_CATEGORY, "身長・体型について、アバター同士の会話で触れてもよいですか？", [
    DISCLOSURE_CONSENT_OK, DISCLOSURE_CONSENT_NG,
  ], { consentForGroup: "appearance" }),
  choice("q41", 22, DISCLOSURE_CATEGORY, "結婚歴・お子さんの有無について、アバター同士の会話で触れてもよいですか？", [
    DISCLOSURE_CONSENT_OK, DISCLOSURE_CONSENT_NG,
  ], { consentForGroup: "family_marital" }),
  // --- 既存20問 (displayOrder 23〜42。コードは変更しない) ---
  choice("q01", 23, "休日・趣味", "休日の過ごし方に最も近いのは？", ["外へ出かける", "家でゆっくりする", "日によって半々"]),
  choice("q02", 24, "休日・趣味", "自由な時間は誰と過ごすことが多い？", ["一人", "親しい人と少人数", "大勢の仲間"]),
  choice("q03", 25, "休日・趣味", "予定の立て方はどちらに近い？", ["早めに決めたい", "その日の気分で決めたい", "相手に合わせたい"]),
  freeText("q04", 26, "休日・趣味", "最近、時間を忘れて夢中になったことは？"),
  choice("q05", 27, "会話・人付き合い", "初対面の人と話すときの自分は？", ["自分から話す", "相手の話を聞く", "空気を見て決める"]),
  choice("q06", 28, "会話・人付き合い", "心地よい会話のバランスは？", ["たくさん話し合う", "静かな時間も楽しむ", "相手に合わせる"]),
  choice("q07", 29, "会話・人付き合い", "意見が違ったときに取りやすい行動は？", ["率直に話し合う", "少し時間を置く", "共通点を探す"]),
  freeText("q08", 30, "会話・人付き合い", "思わず笑ってしまうのは、どんなとき？"),
  choice("q09", 31, "仕事・生活リズム", "平日の夜の過ごし方に近いのは？", ["外出や交流", "家で休む", "日によって変わる"]),
  choice("q10", 32, "仕事・生活リズム", "忙しい時期の連絡頻度は？", ["短くても毎日", "落ち着いた時にまとめて", "相手と相談して決める"]),
  choice("q11", 33, "仕事・生活リズム", "会う頻度の希望に近いのは？", ["週に何度か", "週に1回程度", "無理のない時に"]),
  freeText("q12", 34, "価値観・将来観", "日々の生活で大切にしていることは？"),
  choice("q13", 35, "価値観・将来観", "お金の使い方で大切なのは？", ["経験に使う", "将来に備える", "バランスを取る"]),
  choice("q14", 36, "価値観・将来観", "新しいことへの向き合い方は？", ["まず試す", "よく調べてから", "信頼する人と一緒なら試す"]),
  choice("q15", 37, "価値観・将来観", "将来のことを話すペースは？", ["早めに話したい", "関係を築いてから", "自然な流れに任せたい"]),
  choice("q16", 38, "恋愛・関係性", "好意や感謝の伝え方に近いのは？", ["言葉で伝える", "行動で示す", "両方を大切にする"]),
  choice("q17", 39, "恋愛・関係性", "一緒にいて心地よいと感じる相手は？", ["笑いのツボが合う", "価値観が近い", "新しい視点をくれる"]),
  freeText("q18", 40, "恋愛・関係性", "すれ違いが起きたとき、相手にどう向き合ってほしい？"),
  choice("q19", 41, "譲れない条件", "関係を築くうえで最も大切なのは？", ["誠実さ", "生活リズム", "会話の相性"]),
  freeText("q20", 42, "自由回答", "相手に、これだけは知っておいてほしいことは？"),
] as const satisfies readonly InterviewQuestion[];

// 相手に紹介してほしい性別を尋ねる質問のコード。demo_candidatesの絞り込みに使う
// (src/features/matching/server/queries.tsやSQL側と役割が異なるため、コードだけを
// 一元管理ポイントとしてここに置く)。
export const PARTNER_GENDER_QUESTION_CODE: InterviewQuestionCode = "q42";

// 質問総数。20固定の前提が各所に散らばっていたため、ここから導出する形に一本化する。
export const TOTAL_QUESTIONS = INTERVIEW_QUESTIONS.length;

// 質問コード一覧(コード順ではなく宣言順)。zodのenumやAI応答schemaのenum生成に使う。
export const INTERVIEW_QUESTION_CODES = INTERVIEW_QUESTIONS.map(
  (question) => question.code,
) as unknown as readonly [InterviewQuestionCode, ...InterviewQuestionCode[]];

// コード昇順(q01, q02, ... q42)に並べた質問一覧。
// DBの `order by question_code` (テキスト昇順)と同じ並びになる。
export const INTERVIEW_QUESTIONS_BY_CODE = [...INTERVIEW_QUESTIONS].sort((left, right) =>
  left.code.localeCompare(right.code),
);

export function findInterviewQuestion(code: string): InterviewQuestion | undefined {
  return INTERVIEW_QUESTIONS.find((question) => question.code === code);
}

// 質問コード → 開示グループ。INTERVIEW_QUESTIONSから機械的に導出する
// (デリケート判定の一元管理ポイント。ここ以外でsensitiveGroupを再定義しないこと)。
export const SENSITIVE_QUESTION_GROUPS: ReadonlyMap<InterviewQuestionCode, SensitiveGroup> = new Map(
  INTERVIEW_QUESTIONS
    .filter((question): question is typeof question & { sensitiveGroup: SensitiveGroup } =>
      question.sensitiveGroup !== null)
    .map((question) => [question.code, question.sensitiveGroup]),
);

// 開示グループ → その開示意思を尋ねる質問コード。INTERVIEW_QUESTIONSから機械的に導出する。
export const CONSENT_QUESTION_CODE_BY_GROUP: ReadonlyMap<SensitiveGroup, InterviewQuestionCode> = new Map(
  INTERVIEW_QUESTIONS
    .filter((question): question is typeof question & { consentForGroup: SensitiveGroup } =>
      question.consentForGroup !== null)
    .map((question) => [question.consentForGroup, question.code]),
);

// AIへの入力から常に除外する質問のコード一覧。
// - 開示意思を尋ねる質問(q38〜q41): 会話材料としての意味を持たない(本人の意思表明そのもの)。
// - 相手に紹介してほしい性別を尋ねる質問(q42, PARTNER_GENDER_QUESTION_CODE):
//   候補者の絞り込み条件であり、会話で相手に伝える内容ではない。
const AI_EXCLUDED_QUESTION_CODES: ReadonlySet<InterviewQuestionCode> = new Set([
  ...CONSENT_QUESTION_CODE_BY_GROUP.values(),
  PARTNER_GENDER_QUESTION_CODE,
]);

/** 開示意思の回答値が「触れてよい」を意味するか。 */
export function isDisclosureConsentGiven(answer: string): boolean {
  return answer === DISCLOSURE_CONSENT_OK;
}

/**
 * AIへ渡す前に、開示条件を満たさない回答を除外する。
 *
 * - デリケートでない質問の回答: 常に含める。
 * - 開示意思を尋ねる質問(q38〜q41)・相手の性別希望(q42)自体の回答:
 *   会話材料ではないため常に除外する(AI_EXCLUDED_QUESTION_CODES)。
 * - デリケートな質問の回答: 本人(selfConsentGroups)と相手(counterpartConsentGroups)の
 *   双方が対応する開示グループへ同意している場合だけ含める。
 *
 * src/lib/ai/privacy-provider.tsと同じ方針(AIへ渡す前に取り除く。プロンプト上の指示に頼らない)。
 */
export function filterDisclosableAnswers<T extends { questionCode: InterviewQuestionCode }>(
  answers: readonly T[],
  selfConsentGroups: ReadonlySet<SensitiveGroup>,
  counterpartConsentGroups: ReadonlySet<SensitiveGroup>,
): T[] {
  return answers.filter((answer) => {
    if (AI_EXCLUDED_QUESTION_CODES.has(answer.questionCode)) return false;
    const group = SENSITIVE_QUESTION_GROUPS.get(answer.questionCode);
    if (!group) return true;
    return selfConsentGroups.has(group) && counterpartConsentGroups.has(group);
  });
}

export function findFirstUnansweredOrder(
  questions: readonly InterviewQuestion[],
  answers: readonly InterviewAnswer[],
): number | null {
  const answeredCodes = new Set(answers.map((answer) => answer.questionCode));
  return questions.find((question) => !answeredCodes.has(question.code))?.displayOrder ?? null;
}

export function getAllowedInterviewOrder(
  requestedOrder: number,
  questions: readonly InterviewQuestion[],
  answers: readonly InterviewAnswer[],
): number {
  const requestedQuestion = questions.find((question) => question.displayOrder === requestedOrder);
  const hasExistingAnswer = requestedQuestion
    ? answers.some((answer) => answer.questionCode === requestedQuestion.code)
    : false;
  const firstUnansweredOrder = findFirstUnansweredOrder(questions, answers);

  if (!hasExistingAnswer && firstUnansweredOrder !== null && requestedOrder > firstUnansweredOrder) {
    return firstUnansweredOrder;
  }
  return requestedOrder;
}
