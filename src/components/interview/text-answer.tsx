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
        aria-describedby={`${inputId}-hint`}
        className={styles.textarea}
        defaultValue={currentAnswer}
        id={inputId}
        minLength={question.minLength}
        name="answer"
        placeholder="回答を入力してください"
        required
      />
      <p className={styles.hint} id={`${inputId}-hint`}>500文字以内</p>
      <button className={styles.send} type="submit">送信</button>
    </form>
  );
}
