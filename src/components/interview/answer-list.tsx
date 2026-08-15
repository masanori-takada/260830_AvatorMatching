import Link from "next/link";

import type { InterviewAnswer, InterviewQuestion } from "@/features/interview/domain";
import styles from "./interview.module.css";

type AnswerListProps = {
  answers: readonly InterviewAnswer[];
  locked: boolean;
  questions: readonly InterviewQuestion[];
};

// マイページの回答一覧。マッチング開始前(!locked)に限り、回答済み質問へ
// 「修正する」導線を出す(FR-008、FR-034)。開始後は導線自体を出さず、
// 呼び出し側がロック理由を別途説明する。
export function AnswerList({ answers, locked, questions }: AnswerListProps) {
  const answerByCode = new Map(answers.map((answer) => [answer.questionCode, answer]));

  return (
    <div className={styles.answerList}>
      {questions.map((question) => {
        const answer = answerByCode.get(question.code);
        return (
          <section
            aria-labelledby={`${question.code}-mypage-prompt`}
            className={styles.answerCard}
            key={question.code}
          >
            <p className={styles.category}>{question.category}</p>
            <p className={styles.answerPrompt} id={`${question.code}-mypage-prompt`}>
              {question.prompt}
            </p>
            <p className={answer ? styles.answerBody : `${styles.answerBody} ${styles.answerUnanswered}`}>
              {answer ? answer.answer : "未回答"}
            </p>
            {answer && !locked ? (
              <Link className={styles.answerEdit} href={`/interview/${question.displayOrder}`}>
                修正する
              </Link>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
