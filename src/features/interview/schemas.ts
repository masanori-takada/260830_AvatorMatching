import { z } from "zod";

import type { InterviewQuestion } from "@/features/interview/domain";

export const saveInterviewAnswerInputSchema = z.object({
  questionCode: z.string().regex(/^q(?:0[1-9]|1[0-9]|20)$/),
  answer: z.string(),
  expectedRevision: z.number().int().positive().nullable(),
});

export class InterviewAnswerValidationError extends Error {}

export function parseInterviewAnswer(question: InterviewQuestion, rawAnswer: string): string {
  const answer = rawAnswer.trim();

  if (question.kind === "choice") {
    if (!question.choices.includes(answer)) {
      throw new InterviewAnswerValidationError("選択肢から回答してください。");
    }
    return answer;
  }

  const characterCount = Array.from(answer).length;
  if (characterCount < question.minLength) {
    throw new InterviewAnswerValidationError("1文字以上入力してください。");
  }
  if (characterCount > question.maxLength) {
    throw new InterviewAnswerValidationError("500文字以内で入力してください。");
  }
  return answer;
}
