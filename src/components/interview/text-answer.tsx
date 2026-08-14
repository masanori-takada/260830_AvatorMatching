import type { FreeTextQuestion } from "@/features/interview/domain";
import styles from "./interview.module.css";

type TextAnswerProps = {
  action: (formData: FormData) => void | Promise<void>;
  question: FreeTextQuestion;
  currentAnswer?: string;
};

export function TextAnswer({ action, question, currentAnswer }: TextAnswerProps) {
  const inputId = `${question.code}-answer`;
  return (
    <form action={action} className={styles.textForm}>
      <label className={styles.hint} htmlFor={inputId}>回答を入力</label>
      <textarea
        className={styles.textarea}
        defaultValue={currentAnswer}
        id={inputId}
        maxLength={question.maxLength}
        minLength={question.minLength}
        name="answer"
        placeholder="回答を入力してください"
        required
      />
      <button className={styles.send} type="submit">送信</button>
    </form>
  );
}
