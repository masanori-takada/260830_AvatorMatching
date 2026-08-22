import { redirect } from "next/navigation";

import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import { getInterviewState } from "@/features/interview/server/queries";
import { requireUser } from "@/features/identity/server/session";

export default async function InterviewCompletePage() {
  const { userId } = await requireUser();
  const state = await getInterviewState(userId);
  if (state.answeredCount < TOTAL_QUESTIONS) {
    const firstUnanswered = state.questions.find(
      (question) => !state.answers.some((answer) => answer.questionCode === question.code),
    );
    redirect(`/interview/${firstUnanswered?.displayOrder ?? 1}`);
  }

  // 旧URLからアクセスした場合も、要約画面を表示せず会話開始へ進める。
  redirect("/matching");
}
