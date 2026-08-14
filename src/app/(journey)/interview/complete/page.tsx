import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import styles from "@/components/interview/interview.module.css";
import { Progress } from "@/components/interview/progress";
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

  return (
    <AppShell>
      <Progress answeredCount={20} />
      <section className={styles.complete}>
        <h2 className={styles.title}>回答が完了しました</h2>
        <p className={styles.copy}>20問すべての回答を保存しました。</p>
      </section>
    </AppShell>
  );
}
