import type { InterviewAnswer, InterviewQuestion } from "@/features/interview/domain";
import { ChoiceAnswer } from "./choice-answer";
import styles from "./interview.module.css";
import { TextAnswer } from "./text-answer";

type QuestionCardProps = {
  action: (formData: FormData) => void | Promise<void>;
  answer?: InterviewAnswer;
  question: InterviewQuestion;
};

export function QuestionCard({ action, answer, question }: QuestionCardProps) {
  return (
    <section aria-labelledby={`${question.code}-prompt`} className={styles.card}>
      <p className={styles.category}>{question.category}</p>
      <h2 className={styles.prompt} id={`${question.code}-prompt`}>{question.prompt}</h2>
      {question.kind === "choice" ? (
        <ChoiceAnswer action={action} currentAnswer={answer?.answer} question={question} />
      ) : (
        <TextAnswer action={action} currentAnswer={answer?.answer} question={question} />
      )}
    </section>
  );
}
