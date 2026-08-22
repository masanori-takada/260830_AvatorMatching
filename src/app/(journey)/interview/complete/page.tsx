import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { CompletionForm } from "@/components/interview/completion-form";
import { Progress } from "@/components/interview/progress";
import { completeInterview } from "@/features/avatar-profile/server/service";
import { TOTAL_QUESTIONS } from "@/features/interview/domain";
import { getInterviewState } from "@/features/interview/server/queries";
import { requireUser } from "@/features/identity/server/session";

// このページのServer Action(complete)がcompleteInterview経由でGemini APIを呼ぶ。
// GEMINI_TIMEOUT_MS(20秒)+スキーマ違反時の1回リトライで最悪約40秒かかりうるため、
// Vercelの既定の実行時間上限（10〜15秒）による打ち切りを避けるべく明示的に延長する。
export const maxDuration = 60;

export default async function InterviewCompletePage() {
  const { userId } = await requireUser();
  const state = await getInterviewState(userId);
  if (state.answeredCount < TOTAL_QUESTIONS) {
    const firstUnanswered = state.questions.find(
      (question) => !state.answers.some((answer) => answer.questionCode === question.code),
    );
    redirect(`/interview/${firstUnanswered?.displayOrder ?? 1}`);
  }

  async function complete() {
    "use server";
    return completeInterview();
  }

  return (
    <AppShell activeTab="home" showNavigation>
      <Progress answeredCount={TOTAL_QUESTIONS} />
      <CompletionForm action={complete} />
    </AppShell>
  );
}
