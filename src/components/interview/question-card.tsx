import { DISCLOSURE_CATEGORY, type InterviewAnswer, type InterviewQuestion } from "@/features/interview/domain";
import { ChoiceAnswer } from "./choice-answer";
import styles from "./interview.module.css";
import { TextAnswer } from "./text-answer";

type QuestionCardProps = {
  action: (formData: FormData) => void | Promise<void>;
  answer?: InterviewAnswer;
  question: InterviewQuestion;
  userId: string;
  expectedRevision: number | null;
};

export function QuestionCard({ action, answer, question, userId, expectedRevision }: QuestionCardProps) {
  return (
    <section aria-labelledby={`${question.code}-prompt`} className={styles.card}>
      <p className={styles.category}>{question.category}</p>
      <h2 className={styles.prompt} id={`${question.code}-prompt`}>{question.prompt}</h2>
      {question.category === DISCLOSURE_CATEGORY ? (
        <p className={styles.hint}>
          この項目は、あなたと相手の双方が「アバター同士の会話で触れてよい」を選んだ場合にだけ、会話で扱われます。
        </p>
      ) : null}
      {question.kind === "choice" ? (
        <ChoiceAnswer action={action} currentAnswer={answer?.answer} question={question} />
      ) : (
        <TextAnswer
          currentAnswer={answer?.answer}
          expectedRevision={expectedRevision}
          question={question}
          userId={userId}
        />
      )}
    </section>
  );
}
