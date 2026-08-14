import type { ChoiceQuestion } from "@/features/interview/domain";
import styles from "./interview.module.css";

type ChoiceAnswerProps = {
  action: (formData: FormData) => void | Promise<void>;
  question: ChoiceQuestion;
  currentAnswer?: string;
};

export function ChoiceAnswer({ action, question, currentAnswer }: ChoiceAnswerProps) {
  return (
    <form action={action} className={styles.choiceForm}>
      <div aria-label="回答を選択" className={styles.choiceList} role="group">
        {question.choices.map((option) => (
          <button
            className={styles.choice}
            data-selected={currentAnswer === option}
            key={option}
            name="answer"
            type="submit"
            value={option}
          >
            {option}
          </button>
        ))}
      </div>
    </form>
  );
}
