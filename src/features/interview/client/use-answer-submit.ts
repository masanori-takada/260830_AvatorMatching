"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { InterviewQuestionCode, SaveInterviewAnswerOutput } from "@/features/interview/domain";
import { saveInterviewAnswer } from "@/features/interview/server/actions";
import type { ActionResult } from "@/lib/result";

import { localDraftStore, type DraftStore } from "./draft-store";

type UseAnswerSubmitInput = {
  userId: string;
  questionCode: InterviewQuestionCode;
  initialAnswer: string;
  expectedRevision: number | null;
  draftStore?: DraftStore;
};

type UseAnswerSubmitResult = {
  value: string;
  onChange: (next: string) => void;
  submit: () => Promise<ActionResult<SaveInterviewAnswerOutput>>;
  pending: boolean;
  error: string | null;
};

// 回答入力を端末へ一時保存しつつ送信するフック。
// - マウント時: 未送信の下書きがあれば優先して復元する(中断・再開)。
// - 入力ごと: 下書きを保存し続ける(通信断でも入力内容を失わない、FR-031)。
// - 送信成功: 下書きを消し、サーバーが返した次の画面へ遷移する。
// - 送信失敗: 下書きを残したまま再送できるようエラーだけを表示する。
export function useAnswerSubmit({
  userId,
  questionCode,
  initialAnswer,
  expectedRevision,
  draftStore = localDraftStore,
}: UseAnswerSubmitInput): UseAnswerSubmitResult {
  const router = useRouter();
  const [value, setValue] = useState(() => draftStore.load(userId, questionCode) ?? initialAnswer);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revisionRef = useRef(expectedRevision);

  useEffect(() => {
    revisionRef.current = expectedRevision;
  }, [expectedRevision]);

  const onChange = useCallback((next: string) => {
    setValue(next);
    if (next.trim().length === 0) {
      draftStore.remove(userId, questionCode);
    } else {
      draftStore.save(userId, questionCode, next);
    }
  }, [draftStore, questionCode, userId]);

  const submit = useCallback(async () => {
    setPending(true);
    setError(null);
    const result = await saveInterviewAnswer({
      questionCode,
      answer: value,
      expectedRevision: revisionRef.current,
    });
    setPending(false);

    if (result.ok) {
      draftStore.remove(userId, questionCode);
      router.push(result.data.nextPath);
      return result;
    }

    // 保存失敗時は入力内容を端末へ保持し、再送できるようにする
    draftStore.save(userId, questionCode, value);
    setError(result.error.message);
    return result;
  }, [draftStore, questionCode, router, userId, value]);

  return { value, onChange, submit, pending, error };
}
