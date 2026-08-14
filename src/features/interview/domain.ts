export type InterviewQuestionCode = `q${string}`;

export type ChoiceQuestion = {
  code: InterviewQuestionCode;
  displayOrder: number;
  category: string;
  kind: "choice";
  prompt: string;
  choices: readonly [string, string, string];
  minLength: null;
  maxLength: null;
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
  choices: readonly [string, string, string],
): ChoiceQuestion => ({
  code,
  displayOrder,
  category,
  kind: "choice",
  prompt,
  choices,
  minLength: null,
  maxLength: null,
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
});

// 承認済み仕様の固定質問。表示文言と順序はDBの参照データと同期する。
export const INTERVIEW_QUESTIONS = [
  choice("q01", 1, "休日・趣味", "休日の過ごし方に最も近いのは？", ["外へ出かける", "家でゆっくりする", "日によって半々"]),
  choice("q02", 2, "休日・趣味", "自由な時間は誰と過ごすことが多い？", ["一人", "親しい人と少人数", "大勢の仲間"]),
  choice("q03", 3, "休日・趣味", "予定の立て方はどちらに近い？", ["早めに決めたい", "その日の気分で決めたい", "相手に合わせたい"]),
  freeText("q04", 4, "休日・趣味", "最近、時間を忘れて夢中になったことは？"),
  choice("q05", 5, "会話・人付き合い", "初対面の人と話すときの自分は？", ["自分から話す", "相手の話を聞く", "空気を見て決める"]),
  choice("q06", 6, "会話・人付き合い", "心地よい会話のバランスは？", ["たくさん話し合う", "静かな時間も楽しむ", "相手に合わせる"]),
  choice("q07", 7, "会話・人付き合い", "意見が違ったときに取りやすい行動は？", ["率直に話し合う", "少し時間を置く", "共通点を探す"]),
  freeText("q08", 8, "会話・人付き合い", "思わず笑ってしまうのは、どんなとき？"),
  choice("q09", 9, "仕事・生活リズム", "平日の夜の過ごし方に近いのは？", ["外出や交流", "家で休む", "日によって変わる"]),
  choice("q10", 10, "仕事・生活リズム", "忙しい時期の連絡頻度は？", ["短くても毎日", "落ち着いた時にまとめて", "相手と相談して決める"]),
  choice("q11", 11, "仕事・生活リズム", "会う頻度の希望に近いのは？", ["週に何度か", "週に1回程度", "無理のない時に"]),
  freeText("q12", 12, "価値観・将来観", "日々の生活で大切にしていることは？"),
  choice("q13", 13, "価値観・将来観", "お金の使い方で大切なのは？", ["経験に使う", "将来に備える", "バランスを取る"]),
  choice("q14", 14, "価値観・将来観", "新しいことへの向き合い方は？", ["まず試す", "よく調べてから", "信頼する人と一緒なら試す"]),
  choice("q15", 15, "価値観・将来観", "将来のことを話すペースは？", ["早めに話したい", "関係を築いてから", "自然な流れに任せたい"]),
  choice("q16", 16, "恋愛・関係性", "好意や感謝の伝え方に近いのは？", ["言葉で伝える", "行動で示す", "両方を大切にする"]),
  choice("q17", 17, "恋愛・関係性", "一緒にいて心地よいと感じる相手は？", ["笑いのツボが合う", "価値観が近い", "新しい視点をくれる"]),
  freeText("q18", 18, "恋愛・関係性", "すれ違いが起きたとき、相手にどう向き合ってほしい？"),
  choice("q19", 19, "譲れない条件", "関係を築くうえで最も大切なのは？", ["誠実さ", "生活リズム", "会話の相性"]),
  freeText("q20", 20, "自由回答", "相手に、これだけは知っておいてほしいことは？"),
] as const satisfies readonly InterviewQuestion[];

export function findInterviewQuestion(code: string): InterviewQuestion | undefined {
  return INTERVIEW_QUESTIONS.find((question) => question.code === code);
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
