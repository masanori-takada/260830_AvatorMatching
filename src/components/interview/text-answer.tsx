"use client";

// 自由記述の回答欄。通信断で入力内容を失わないよう(FR-031)、
// クライアント側で下書きを端末保存しつつ、useAnswerSubmitでサーバーへ送信する。
// 選択式(ChoiceAnswer)は1クリックで完結し失うものがないため、サーバーフォームのまま据え置く。
import type { FormEvent } from "react";

import { useAnswerSubmit } from "@/features/interview/client/use-answer-submit";
import type { FreeTextQuestion } from "@/features/interview/domain";
import styles from "./interview.module.css";

type TextAnswerProps = {
  question: FreeTextQuestion;
  currentAnswer?: string;
  userId: string;
  expectedRevision: number | null;
};

export function TextAnswer({ question, currentAnswer, userId, expectedRevision }: TextAnswerProps) {
  const { value, onChange, submit, pending, error } = useAnswerSubmit({
    userId,
    questionCode: question.code,
    initialAnswer: currentAnswer ?? "",
    expectedRevision,
  });

  const inputId = `${question.code}-answer`;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      // 送信中の二重送信を防ぐ
      return;
    }
    void submit();
  };

  return (
    <form className={styles.textForm} onSubmit={handleSubmit}>
      <label className={styles.hint} htmlFor={inputId}>回答を入力</label>
      <textarea
        aria-describedby={`${inputId}-hint`}
        className={styles.textarea}
        id={inputId}
        minLength={question.minLength}
        name="answer"
        onChange={(event) => onChange(event.target.value)}
        placeholder="回答を入力してください"
        required
        value={value}
      />
      <p className={styles.hint} id={`${inputId}-hint`}>500文字以内</p>
      {error ? (
        <div className={styles.unsavedNotice} role="alert">
          <p className={styles.unsavedLabel}>未保存の回答です。このまま端末に保持されています。</p>
          <p className={styles.error}>{error}</p>
        </div>
      ) : null}
      <button className={styles.send} disabled={pending} type="submit">
        {error ? "再送する" : "送信"}
      </button>
    </form>
  );
}
