import { AppShell } from "@/components/app-shell/app-shell";
import { AnswerList } from "@/components/interview/answer-list";
import styles from "@/components/interview/interview.module.css";
import { requireUser } from "@/features/identity/server/session";
import { getInterviewState } from "@/features/interview/server/queries";
import { describeJourneyState, deriveJourneyState, getJourneySnapshot } from "@/features/matching/server/journey-state";

export default async function MyPage() {
  const { userId } = await requireUser();
  const [interviewState, snapshot] = await Promise.all([
    getInterviewState(userId),
    getJourneySnapshot(userId),
  ]);
  const journey = deriveJourneyState(snapshot);

  return (
    <AppShell activeTab="mypage" showNavigation>
      <h1 className={styles.title}>マイページ</h1>

      <section className={styles.summaryCard}>
        <p className={styles.category}>現在のステップ</p>
        <p className={styles.copy}>{describeJourneyState(journey.state, journey.connectionState)}</p>
      </section>

      {interviewState.locked ? (
        <p className={styles.error} role="status">
          マッチング開始後は回答を変更できません。現在の相性評価との不整合を避けるためです。
        </p>
      ) : null}

      <h2 className={styles.sectionTitle}>インタビューの回答</h2>
      <AnswerList
        answers={interviewState.answers}
        locked={interviewState.locked}
        questions={interviewState.questions}
      />
    </AppShell>
  );
}
