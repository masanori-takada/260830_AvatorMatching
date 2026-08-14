import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import styles from "@/components/interview/interview.module.css";
import { Progress } from "@/components/interview/progress";
import { QuestionCard } from "@/components/interview/question-card";
import { saveInterviewAnswer } from "@/features/interview/server/actions";
import { getAllowedInterviewOrder } from "@/features/interview/domain";
import { getInterviewState } from "@/features/interview/server/queries";
import { requireUser } from "@/features/identity/server/session";

type InterviewPageProps = {
  params: Promise<{ order: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
};

export default async function InterviewPage({ params, searchParams }: InterviewPageProps) {
  const [{ order: rawOrder }, query, { userId }] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);
  const order = Number(rawOrder);
  if (!Number.isInteger(order) || order < 1 || order > 20) {
    notFound();
  }

  const state = await getInterviewState(userId);
  const allowedOrder = getAllowedInterviewOrder(order, state.questions, state.answers);
  if (allowedOrder !== order) {
    redirect(`/interview/${allowedOrder}`);
  }
  const question = state.questions.find((candidate) => candidate.displayOrder === order);
  if (!question) {
    notFound();
  }
  const answer = state.answers.find((candidate) => candidate.questionCode === question.code);

  async function submit(formData: FormData) {
    "use server";
    const result = await saveInterviewAnswer({
      questionCode: question!.code,
      answer: String(formData.get("answer") ?? ""),
      expectedRevision: answer?.revision ?? null,
    });
    if (result.ok) {
      redirect(result.data.nextPath);
    }
    redirect(`/interview/${order}?error=${encodeURIComponent(result.error.message)}`);
  }

  const error = Array.isArray(query.error) ? query.error[0] : query.error;
  return (
    <AppShell>
      <Progress answeredCount={state.answeredCount} />
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {state.locked ? (
        <p className={styles.error} role="status">マッチング開始後は回答を変更できません。</p>
      ) : (
        <QuestionCard action={submit} answer={answer} question={question} />
      )}
    </AppShell>
  );
}
