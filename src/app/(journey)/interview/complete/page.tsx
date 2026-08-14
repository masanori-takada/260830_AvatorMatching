import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { CompletionForm } from "@/components/interview/completion-form";
import { Progress } from "@/components/interview/progress";
import { completeInterview } from "@/features/avatar-profile/server/service";
import { getInterviewState } from "@/features/interview/server/queries";
import { requireUser } from "@/features/identity/server/session";

export default async function InterviewCompletePage() {
  const { userId } = await requireUser();
  const state = await getInterviewState(userId);
  if (state.answeredCount < 20) {
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
    <AppShell>
      <Progress answeredCount={20} />
      <CompletionForm action={complete} />
    </AppShell>
  );
}
