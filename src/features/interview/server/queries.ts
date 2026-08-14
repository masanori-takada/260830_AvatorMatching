import type {
  InterviewAnswer,
  InterviewQuestion,
} from "@/features/interview/domain";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type QuestionRow = {
  code: `q${string}`;
  display_order: number;
  category: string;
  kind: "choice" | "free_text";
  prompt: string;
  choices: string[];
  min_length: number | null;
  max_length: number | null;
};

type AnswerRow = {
  question_code: `q${string}`;
  answer: string;
  revision: number;
};

export async function getInterviewState(userId: string): Promise<{
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  answeredCount: number;
  locked: boolean;
}> {
  const supabase = await createServerSupabaseClient();
  const [questionResult, answerResult, lockResult] = await Promise.all([
    supabase
      .from("interview_questions")
      .select("code, display_order, category, kind, prompt, choices, min_length, max_length")
      .eq("active", true)
      .order("display_order"),
    supabase
      .from("interview_answers")
      .select("question_code, answer, revision")
      .eq("owner_id", userId),
    supabase.rpc("is_interview_locked"),
  ]);

  const error = questionResult.error ?? answerResult.error ?? lockResult.error;
  if (error) {
    throw error;
  }

  const questions = ((questionResult.data ?? []) as QuestionRow[]).map(toQuestion);
  const answers = ((answerResult.data ?? []) as AnswerRow[]).map((answer) => ({
    questionCode: answer.question_code,
    answer: answer.answer,
    revision: answer.revision,
  }));

  return {
    questions,
    answers,
    answeredCount: answers.length,
    locked: lockResult.data === true,
  };
}

function toQuestion(row: QuestionRow): InterviewQuestion {
  if (row.kind === "choice") {
    if (row.choices.length !== 3) {
      throw new Error("選択式質問の選択肢数が不正です。");
    }
    return {
      code: row.code,
      displayOrder: row.display_order,
      category: row.category,
      kind: "choice",
      prompt: row.prompt,
      choices: [row.choices[0]!, row.choices[1]!, row.choices[2]!],
      minLength: null,
      maxLength: null,
    };
  }

  return {
    code: row.code,
    displayOrder: row.display_order,
    category: row.category,
    kind: "free_text",
    prompt: row.prompt,
    choices: [],
    minLength: 1,
    maxLength: 500,
  };
}
