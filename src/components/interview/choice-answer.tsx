"use client";

// 選択式の回答ボタン。Server Action(action)への送信はサーバー往復を伴うため、
// 押してから次の設問が出るまでにラグが生じる(押下150ms後も見た目が変化しないと
// 「反応がない」と誤解され連打・二重送信につながる。notification-cardと同種の問題)。
// 選択肢は複数あるため、押した瞬間に「どれを押したか」が分かるようにしつつ、
// 連打防止のため他の選択肢もあわせて無効化する。
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { PendingButton } from "@/components/feedback/pending-button";
import type { ChoiceQuestion } from "@/features/interview/domain";
import styles from "./interview.module.css";

type ChoiceAnswerProps = {
  action: (formData: FormData) => void | Promise<void>;
  question: ChoiceQuestion;
  currentAnswer?: string;
};

export function ChoiceAnswer({ action, question, currentAnswer }: ChoiceAnswerProps) {
  // どの選択肢が押されたか(押した瞬間、送信完了を待たずに同期的にセットする)
  const [pressedValue, setPressedValue] = useState<string | null>(null);

  return (
    <form action={action} className={styles.choiceForm}>
      <div aria-label="回答を選択" className={styles.choiceList} role="group">
        {question.choices.map((option) => (
          <ChoiceButton
            currentAnswer={currentAnswer}
            key={option}
            onPress={() => setPressedValue(option)}
            option={option}
            pressed={pressedValue === option}
          />
        ))}
      </div>
    </form>
  );
}

// useFormStatusは親<form>のsubmit状態を参照するため、<form>とは別のコンポーネントで
// 呼ぶ必要がある(notification-cardのNotificationButtonと同じ構造)。
function ChoiceButton({
  currentAnswer,
  onPress,
  option,
  pressed,
}: {
  currentAnswer?: string;
  onPress: () => void;
  option: string;
  pressed: boolean;
}) {
  const { pending: formPending } = useFormStatus();

  return (
    <PendingButton
      className={styles.choice}
      data-selected={currentAnswer === option}
      disabled={formPending}
      name="answer"
      onClick={onPress}
      pending={formPending && pressed}
      type="submit"
      value={option}
    >
      {option}
    </PendingButton>
  );
}
